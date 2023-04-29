import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { AccountBalances } from '../account'
import { Board } from '../board'
import { CollateralUpdateEvent } from '../collateral_update_event'
import { MAX_BN, UNIT, ZERO_ADDRESS, ZERO_BN } from '../constants/bn'
import { DataSource, DEFAULT_ITERATIONS, LyraMarketContractId } from '../constants/contracts'
import { AvalonOptionMarket } from '../contracts/avalon/typechain'
import { NewportOptionMarket } from '../contracts/newport/typechain'
import Lyra, { Version } from '../lyra'
import { Market, MarketToken } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { Quote, QuoteDisabledReason, QuoteFeeComponents, QuoteGreeks, QuoteIteration } from '../quote'
import { Strike } from '../strike'
import { TradeEvent } from '../trade_event'
import buildTx from '../utils/buildTx'
import { from18DecimalBN } from '../utils/convertBNDecimals'
import fromBigNumber from '../utils/fromBigNumber'
import getAverageCollateralSpotPrice from '../utils/getAverageCollateralSpotPrice'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getBreakEvenPrice from '../utils/getBreakEvenPrice'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getOptionType from '../utils/getOptionType'
import getProjectedSettlePnl from '../utils/getProjectedSettlePnl'
import getTradePnl from '../utils/getTradePnl'
import parsePartialPositionUpdatedEventsFromLogs from '../utils/parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventsFromLogs from '../utils/parsePartialTradeEventsFromLogs'
import toBigNumber from '../utils/toBigNumber'
import getMaxLoss from './getMaxLoss'
import getMaxProfit from './getMaxProfit'
import getTradeCollateral from './getTradeCollateral'
import getTradeDisabledReason from './getTradeDisabledReason'

export enum TradeDisabledReason {
  EmptySize = 'EmptySize',
  Expired = 'Expired',
  TradingCutoff = 'TradingCutoff',
  InsufficientLiquidity = 'InsufficientLiquidity',
  DeltaOutOfRange = 'DeltaOutOfRange',
  VolTooHigh = 'VolTooHigh',
  VolTooLow = 'VolTooLow',
  IVTooHigh = 'IVTooHigh',
  IVTooLow = 'IVTooLow',
  SkewTooHigh = 'SkewTooHigh',
  SkewTooLow = 'SkewTooLow',
  NotEnoughCollateral = 'NotEnoughCollateral',
  TooMuchCollateral = 'TooMuchCollateral',
  EmptyCollateral = 'EmptyCollateral',
  IncorrectOwner = 'IncorrectOwner',
  PositionClosed = 'PositionClosed',
  PositionNotLargeEnough = 'PositionNotLargeEnough',
  PositionClosedLeftoverCollateral = 'PositionClosedLeftoverCollateral',
  InsufficientQuoteAllowance = 'InsufficientQuoteAllowance',
  InsufficientBaseAllowance = 'InsufficientBaseAllowance',
  InsufficientQuoteBalance = 'InsufficientQuoteBalance',
  InsufficientBaseBalance = 'InsufficientBaseBalance',
  UnableToHedgeDelta = 'UnableToHedgeDelta',
  PriceVarianceTooHigh = 'PriceVarianceTooHigh',
}

export type TradeCollateral = {
  amount: BigNumber
  min: BigNumber
  max: BigNumber | null
  isMin: boolean
  isMax: boolean
  isBase: boolean
  // If null, no liquidation price (fully collateralized)
  liquidationPrice: BigNumber | null
}

export type TradeOptions = {
  positionId?: number
  setToCollateral?: BigNumber
  setToFullCollateral?: boolean
  isBaseCollateral?: boolean
  iterations?: number
}

export type TradeOptionsSync = {
  position?: Position
} & Omit<TradeOptions, 'positionId'>

export type TradeToken = MarketToken & {
  transfer: BigNumber
  receive: BigNumber
  balance: BigNumber
  newBalance: BigNumber
}

export class Trade {
  lyra: Lyra
  private __option: Option
  private __position?: Position
  private __balances: AccountBalances
  __source = DataSource.ContractCall
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  boardId: number
  strikePrice: BigNumber
  strikeId: number
  isCall: boolean
  positionId?: number
  isBuy: boolean
  isOpen: boolean
  isLong: boolean
  owner: string
  size: BigNumber
  newSize: BigNumber
  prevSize: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  quoted: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  collateral?: TradeCollateral
  iv: BigNumber
  fairIv: BigNumber
  greeks: QuoteGreeks
  slippage: number
  baseToken: TradeToken
  quoteToken: TradeToken
  forceClosePenalty: BigNumber
  spotPrice: BigNumber
  isCollateralUpdate: boolean
  isForceClose: boolean
  isDisabled: boolean
  disabledReason: TradeDisabledReason | null
  tx: PopulatedTransaction
  iterations: QuoteIteration[]
  contract: AvalonOptionMarket | NewportOptionMarket
  method: 'openPosition' | 'closePosition' | 'forceClosePosition'
  params: Parameters<(AvalonOptionMarket | NewportOptionMarket)['openPosition']>
  data: string

  private constructor(
    lyra: Lyra,
    owner: string,
    option: Option,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    balances: AccountBalances,
    options?: TradeOptionsSync
  ) {
    const {
      position,
      setToCollateral = ZERO_BN,
      setToFullCollateral = false,
      iterations = DEFAULT_ITERATIONS,
      isBaseCollateral: _isBaseCollateral,
    } = options ?? {}

    this.__option = option
    this.__position = position
    this.__balances = balances
    const strike = option.strike()
    const market = option.market()
    const board = option.board()

    // References
    this.lyra = lyra

    this.marketName = market.name
    this.marketAddress = market.address
    this.expiryTimestamp = board.expiryTimestamp
    this.boardId = board.id
    this.strikePrice = strike.strikePrice
    this.strikeId = strike.id
    this.isCall = option.isCall
    this.positionId = position?.id

    // Check if opening or closing active position
    this.isBuy = isBuy
    this.isOpen = position ? (isBuy && position.isLong) || (!isBuy && !position.isLong) : true
    this.owner = owner
    this.isLong = position ? position.isLong : isBuy
    const isBaseCollateral = position ? position.collateral?.isBase : _isBaseCollateral
    this.size = size

    let quote = Quote.getSync(lyra, option, this.isBuy, this.size, {
      iterations,
      isOpen: this.isOpen,
      isLong: this.isLong,
    })

    if (
      !this.isOpen &&
      (quote.disabledReason === QuoteDisabledReason.DeltaOutOfRange ||
        quote.disabledReason === QuoteDisabledReason.TradingCutoff ||
        quote.disabledReason === QuoteDisabledReason.PriceVarianceTooHigh)
    ) {
      // Retry quote with force close flag
      quote = Quote.getSync(lyra, option, this.isBuy, this.size, {
        iterations,
        isOpen: this.isOpen,
        isLong: this.isLong,
        isForceClose: true,
      })
    }

    this.isForceClose = quote.isForceClose
    this.iv = quote.iv
    this.fairIv = quote.fairIv
    this.greeks = quote.greeks
    this.fee = quote.fee
    this.feeComponents = quote.feeComponents
    this.forceClosePenalty = quote.forceClosePenalty
    this.spotPrice = quote.spotPrice

    this.iterations = quote.iterations

    // Initialize tokens
    this.quoteToken = {
      ...market.quoteToken,
      transfer: ZERO_BN,
      receive: ZERO_BN,
      balance: balances.quoteAsset.balance,
      newBalance: balances.quoteAsset.balance,
    }
    this.baseToken = {
      ...market.baseToken,
      transfer: ZERO_BN,
      receive: ZERO_BN,
      balance: balances.baseAsset.balance,
      newBalance: balances.baseAsset.balance,
    }

    this.quoted = quote.premium
    this.pricePerOption = ZERO_BN
    this.premium = ZERO_BN

    this.newSize = position ? (this.isOpen ? position.size.add(size) : position.size.sub(size)) : size
    if (this.newSize.lt(0)) {
      this.newSize = ZERO_BN
    }
    this.prevSize = position?.size ?? ZERO_BN

    const minOrMaxPremium = quote.premium.mul(toBigNumber(isBuy ? 1 + slippage : 1 - slippage)).div(UNIT)

    this.slippage = slippage
      ? slippage
      : minOrMaxPremium.gt(0)
      ? 1 - fromBigNumber(quote.premium.mul(UNIT).div(minOrMaxPremium))
      : 0

    // Use min/max premium for true price per option
    this.premium = minOrMaxPremium
    this.pricePerOption = size.gt(0) ? this.premium.mul(UNIT).div(size) : ZERO_BN

    let netQuoteTransfer = this.quoteToken.transfer
    let netBaseTransfer = this.baseToken.transfer

    if (isBuy) {
      // Transferring premium to AMM
      netQuoteTransfer = netQuoteTransfer.add(this.premium)
    } else {
      // Receiveing premium from AMM
      netQuoteTransfer = netQuoteTransfer.sub(this.premium)
    }

    // If opening a short position or modifying an existing short position, check collateral
    if ((this.isOpen && !this.isBuy) || (position && !position.isLong)) {
      this.collateral = getTradeCollateral({
        option: option,
        postTradeSize: this.newSize,
        setToCollateral,
        setToFullCollateral,
        isBaseCollateral,
      })

      // Get collateral change
      const collateralDiff = this.collateral.amount.sub(position?.collateral?.amount ?? ZERO_BN)

      if (this.collateral.isBase) {
        netBaseTransfer = netBaseTransfer.add(collateralDiff)
      } else {
        netQuoteTransfer = netQuoteTransfer.add(collateralDiff)
      }
    }

    if (netQuoteTransfer.gt(0)) {
      this.quoteToken.transfer = from18DecimalBN(netQuoteTransfer, this.quoteToken.decimals)
    } else {
      this.quoteToken.receive = from18DecimalBN(netQuoteTransfer.abs(), this.quoteToken.decimals)
    }

    if (netBaseTransfer.gt(0)) {
      this.baseToken.transfer = from18DecimalBN(netBaseTransfer, this.baseToken.decimals)
    } else {
      this.baseToken.receive = from18DecimalBN(netBaseTransfer.abs(), this.baseToken.decimals)
    }

    this.quoteToken.newBalance = this.quoteToken.transfer.gt(0)
      ? this.quoteToken.balance.sub(this.quoteToken.transfer)
      : this.quoteToken.balance.add(this.quoteToken.receive)
    this.baseToken.newBalance = this.baseToken.transfer.gt(0)
      ? this.baseToken.balance.sub(this.baseToken.transfer)
      : this.baseToken.balance.add(this.baseToken.receive)

    this.isCollateralUpdate = !!(this.collateral && this.size.isZero() && this.collateral.amount.gt(0))

    const strikeIdBN = BigNumber.from(strike.id)
    const positionIdBN = position ? BigNumber.from(position.id) : ZERO_BN
    const iterationsBN = BigNumber.from(iterations)
    const amount = size
    const optionType = getOptionType(option.isCall, this.isLong, !!isBaseCollateral)
    const setCollateralTo = this.collateral?.amount ?? ZERO_BN
    const minTotalCost = !isBuy && minOrMaxPremium.gt(ZERO_BN) ? minOrMaxPremium : ZERO_BN
    const maxTotalCost = isBuy ? minOrMaxPremium : MAX_BN

    this.contract = getLyraMarketContract(
      lyra,
      market.contractAddresses,
      lyra.version,
      LyraMarketContractId.OptionMarket
    )
    this.method =
      this.isOpen || this.isCollateralUpdate
        ? 'openPosition'
        : !this.isForceClose
        ? 'closePosition'
        : 'forceClosePosition'

    if (lyra.version === Version.Avalon) {
      this.params = [
        {
          strikeId: strikeIdBN,
          positionId: positionIdBN,
          iterations: iterationsBN,
          optionType,
          amount,
          setCollateralTo,
          minTotalCost,
          maxTotalCost,
        },
      ]
    } else {
      this.params = [
        {
          strikeId: strikeIdBN,
          positionId: positionIdBN,
          iterations: iterationsBN,
          optionType,
          amount,
          setCollateralTo,
          minTotalCost,
          maxTotalCost,
          referrer: ZERO_ADDRESS,
        },
      ]
    }

    this.data = this.contract.interface.encodeFunctionData(this.method as any, this.params as any)

    this.disabledReason = getTradeDisabledReason({
      isOpen: this.isOpen,
      owner: this.owner,
      size: this.size,
      newSize: this.newSize,
      quote,
      position,
      collateral: this.collateral,
      balances,
      quoteTransfer: this.quoteToken.transfer,
      baseTransfer: this.baseToken.transfer,
    })

    this.isDisabled = !!this.disabledReason

    this.tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      getLyraMarketContract(lyra, market.contractAddresses, lyra.version, LyraMarketContractId.OptionMarket).address,
      owner,
      this.data
    )
  }

  // Getters

  static async get(
    lyra: Lyra,
    owner: string,
    marketAddressOrName: string,
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    options?: TradeOptions
  ): Promise<Trade> {
    const maybeFetchPosition = async (): Promise<Position | undefined> =>
      options?.positionId ? await Position.get(lyra, marketAddressOrName, options.positionId) : undefined

    const [position, balances] = await Promise.all([
      maybeFetchPosition(),
      lyra.account(owner).marketBalances(marketAddressOrName),
    ])

    const option = balances.market.liveOption(strikeId, isCall)

    return new Trade(lyra, owner, option, isBuy, size, slippage, balances, {
      ...options,
      position,
    })
  }

  static getSync(
    lyra: Lyra,
    owner: string,
    option: Option,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    balances: AccountBalances,
    options?: TradeOptionsSync
  ): Trade {
    return new Trade(lyra, owner, option, isBuy, size, slippage, balances, options)
  }

  // Helper Functions

  static getPositionIdsForLogs(lyra: Lyra, logs: Log[]): number[] {
    const trades = parsePartialTradeEventsFromLogs(lyra, logs)
    const updates = parsePartialPositionUpdatedEventsFromLogs(logs)
    const positionIds = [
      ...trades.map(t => t.args.positionId.toNumber()),
      ...updates.map(u => u.args.positionId.toNumber()),
    ]
    return Array.from(new Set(positionIds))
  }

  static getEventsForLogs(lyra: Lyra, logs: Log[]) {
    const trades = parsePartialTradeEventsFromLogs(lyra, logs)
    const updates = parsePartialPositionUpdatedEventsFromLogs(logs)
    return { trades, updates }
  }

  // Transactions

  static approveQuote(market: Market, owner: string, amountQuote: BigNumber): PopulatedTransaction {
    const optionMarket = getLyraMarketContract(
      market.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const erc20 = getERC20Contract(market.lyra.provider, market.quoteToken.address)
    const data = erc20.interface.encodeFunctionData('approve', [optionMarket.address, amountQuote])
    return buildTx(market.lyra.provider, market.lyra.provider.network.chainId, erc20.address, owner, data)
  }

  approveQuote(amountQuote: BigNumber): PopulatedTransaction {
    return Trade.approveQuote(this.market(), this.owner, amountQuote)
  }

  static approveBase(market: Market, owner: string, amountBase: BigNumber): PopulatedTransaction {
    const optionMarket = getLyraMarketContract(
      market.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const erc20 = getERC20Contract(market.lyra.provider, market.baseToken.address)
    const data = erc20.interface.encodeFunctionData('approve', [optionMarket.address, amountBase])
    return buildTx(market.lyra.provider, market.lyra.provider.network.chainId, erc20.address, owner, data)
  }

  approveBase(amountBase: BigNumber): PopulatedTransaction {
    return Trade.approveBase(this.market(), this.owner, amountBase)
  }

  // Dynamic Fields

  pnl(): BigNumber {
    const position = this.__position
    return position ? getTradePnl(position, this) : ZERO_BN
  }

  newAverageCostPerOption(): BigNumber {
    const position = this.__position
    const trades = position ? (position.trades() as (TradeEvent | Trade)[]).concat([this]) : [this]
    return getAverageCostPerOption(trades)
  }

  prevAverageCostPerOption(): BigNumber {
    const position = this.__position
    return position ? getAverageCostPerOption(position.trades()) : ZERO_BN
  }

  newAverageCollateralSpotPrice(): BigNumber {
    if (this.isLong) {
      return ZERO_BN
    }
    const position = this.__position
    if (!position) {
      return this.market().spotPrice
    }
    const collateralUpdates = (position.collateralUpdates() as (CollateralUpdateEvent | Trade)[]).concat([this])
    return getAverageCollateralSpotPrice(position, collateralUpdates)
  }

  prevAverageCollateralSpotPrice(): BigNumber {
    const position = this.__position
    if (this.isLong || !position) {
      return ZERO_BN
    }
    const collateralUpdates = position.collateralUpdates()
    return position ? getAverageCollateralSpotPrice(position, collateralUpdates) : ZERO_BN
  }

  prevCollateralAmount(): BigNumber {
    if (this.isLong || !this.__position) {
      return ZERO_BN
    }
    const collateralUpdates = this.__position.collateralUpdates()
    const prevCollateralUpdate = collateralUpdates.length ? collateralUpdates[collateralUpdates.length - 1] : null
    return prevCollateralUpdate?.amount ?? ZERO_BN
  }

  collateralChangeAmount(): BigNumber {
    if (this.isLong) {
      return ZERO_BN
    }
    const prevCollateralAmount = this.prevCollateralAmount()
    const currCollateralAmount = this.__position?.collateral?.amount ?? ZERO_BN
    return currCollateralAmount.sub(prevCollateralAmount)
  }

  payoff(spotPriceAtExpiry: BigNumber): BigNumber {
    return getProjectedSettlePnl(
      this.isLong,
      this.option().isCall,
      this.strike().strikePrice,
      spotPriceAtExpiry,
      this.newAverageCostPerOption(),
      this.newSize,
      this.collateral?.liquidationPrice
    )
  }

  breakEven(): BigNumber {
    return getBreakEvenPrice(this.isCall, this.strikePrice, this.pricePerOption, !!this.collateral?.isBase)
  }

  maxProfit(): BigNumber {
    return getMaxProfit(this)
  }

  maxLoss(): BigNumber {
    return getMaxLoss(this)
  }

  // Edges

  market(): Market {
    return this.__option.market()
  }

  board(): Board {
    return this.__option.board()
  }

  strike(): Strike {
    return this.__option.strike()
  }

  option(): Option {
    return this.__option
  }

  position(): Position | null {
    return this.__position ?? null
  }

  balances(): AccountBalances {
    return this.__balances
  }
}
