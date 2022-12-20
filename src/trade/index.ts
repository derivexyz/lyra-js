import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { AccountQuoteBalance } from '../account'
import { Board } from '../board'
import { CollateralUpdateEvent } from '../collateral_update_event'
import { MAX_BN, ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { DataSource, DEFAULT_ITERATIONS, LyraContractId } from '../constants/contracts'
import { OptionMarketWrapperWithSwaps } from '../contracts/newport/typechain/OptionMarketWrapper'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { Quote, QuoteDisabledReason, QuoteFeeComponents, QuoteGreeks, QuoteIteration } from '../quote'
import { Strike } from '../strike'
import { TradeEvent } from '../trade_event'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import { from18DecimalBN, to18DecimalBN } from '../utils/convertBNDecimals'
import fromBigNumber from '../utils/fromBigNumber'
import getAverageCollateralSpotPrice from '../utils/getAverageCollateralSpotPrice'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getBreakEvenPrice from '../utils/getBreakEvenPrice'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getLyraContract from '../utils/getLyraContract'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'
import getOptionType from '../utils/getOptionType'
import getPackedTradeCalldata from '../utils/getPackedTradeCalldata'
import getProjectedSettlePnl from '../utils/getProjectedSettlePnl'
import getSwapQuote from '../utils/getSwapQuote'
import getTradePnl from '../utils/getTradePnl'
import isNDecimalPlaces from '../utils/isNDecimalPlaces'
import parsePartialPositionUpdatedEventsFromLogs from '../utils/parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventsFromLogs from '../utils/parsePartialTradeEventsFromLogs'
import roundToDp from '../utils/roundToDp'
import toBigNumber from '../utils/toBigNumber'
import getMaxLoss from './getMaxLoss'
import getMaxProfit from './getMaxProfit'
import getTradeCollateral from './getTradeCollateral'
import getTradeDisabledReason from './getTradeDisabledReason'

// 0.5%
const SWAP_RATE_BUFFER = 0.005

export enum TradeDisabledReason {
  EmptySize = 'EmptySize',
  EmptyPremium = 'EmptyPremium',
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
  PositionWrongOwner = 'PositionWrongOwner',
  PositionClosed = 'PositionClosed',
  PositionNotLargeEnough = 'PositionNotLargeEnough',
  PositionClosedLeftoverCollateral = 'PositionClosedLeftoverCollateral',
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
  premiumSlippage?: number
  minOrMaxPremium?: BigNumber
  setToCollateral?: BigNumber
  setToFullCollateral?: boolean
  isBaseCollateral?: boolean
  iterations?: number
  inputAsset?: {
    address: string
    decimals: number
  }
  swapSlippage?: number
  swapRate?: number
}

export type TradeOptionsSync = {
  position?: Position
  inputAsset?: {
    address: string
    decimals: number
  }
  stables?: AccountQuoteBalance[]
} & Omit<TradeOptions, 'positionId' | 'inputAsset'>

export type TradeToken = {
  address: string
  transfer: BigNumber
  receive: BigNumber
}

export class Trade {
  lyra: Lyra
  private __option: Option
  private __position?: Position
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
  externalSwapFee: BigNumber
  collateral?: TradeCollateral
  iv: BigNumber
  fairIv: BigNumber
  greeks: QuoteGreeks
  slippage: number
  baseToken: TradeToken
  quoteToken: TradeToken
  forceClosePenalty: BigNumber
  isCollateralUpdate: boolean
  isForceClose: boolean
  isDisabled: boolean
  disabledReason: TradeDisabledReason | null
  tx: PopulatedTransaction
  iterations: QuoteIteration[]
  __params: OptionMarketWrapperWithSwaps.OptionPositionParamsStruct
  __calldata: string | null

  private constructor(
    lyra: Lyra,
    owner: string,
    option: Option,
    isBuy: boolean,
    size: BigNumber,
    options?: TradeOptionsSync
  ) {
    const {
      position,
      premiumSlippage,
      setToCollateral = ZERO_BN,
      setToFullCollateral = false,
      minOrMaxPremium: _minOrMaxPremium,
      iterations = DEFAULT_ITERATIONS,
      isBaseCollateral: _isBaseCollateral,
      inputAsset,
      swapRate = 1,
    } = options ?? {}

    this.__option = option
    this.__position = position
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
    })

    if (
      !this.isOpen &&
      (quote.disabledReason === QuoteDisabledReason.DeltaOutOfRange ||
        quote.disabledReason === QuoteDisabledReason.TradingCutoff)
    ) {
      // Retry quote with force close flag
      quote = Quote.getSync(lyra, option, this.isBuy, this.size, {
        iterations,
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

    this.iterations = quote.iterations
    this.externalSwapFee = ZERO_BN

    // Initialize tokens
    this.quoteToken = {
      // TODO: @michaelxuwu Support multiple stables
      address: inputAsset ? inputAsset.address : market.quoteToken.address,
      transfer: ZERO_BN,
      receive: ZERO_BN,
    }
    this.baseToken = {
      address: market.baseToken.address,
      transfer: ZERO_BN,
      receive: ZERO_BN,
    }

    this.quoted = quote.premium
    this.pricePerOption = ZERO_BN
    this.premium = ZERO_BN

    this.newSize = position ? (this.isOpen ? position.size.add(size) : position.size.sub(size)) : size
    if (this.newSize.lt(0)) {
      this.newSize = ZERO_BN
    }
    this.prevSize = position?.size ?? ZERO_BN

    const minOrMaxPremium = _minOrMaxPremium
      ? _minOrMaxPremium
      : premiumSlippage
      ? quote.premium.mul(toBigNumber(isBuy ? 1 + premiumSlippage : 1 - premiumSlippage)).div(UNIT)
      : undefined

    if (!minOrMaxPremium) {
      throw new Error('Must define one of minOrMaxPremium or premiumSlippage')
    }

    this.slippage = premiumSlippage
      ? premiumSlippage
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

    // Get external swap fee
    if (inputAsset && this.option().market().quoteToken.address !== inputAsset.address) {
      // How far swap rate is from 1:1
      const swapRateSlippage = Math.abs(swapRate - 1) + SWAP_RATE_BUFFER
      // Set swap fee to an estimate of premium
      // Based on curve pool fee and configured slippage
      this.externalSwapFee = netQuoteTransfer.abs().mul(toBigNumber(swapRateSlippage)).div(UNIT)
    }

    if (netQuoteTransfer.gt(0)) {
      this.quoteToken.transfer = netQuoteTransfer.add(this.externalSwapFee)
    } else {
      this.quoteToken.receive = netQuoteTransfer.abs().sub(this.externalSwapFee)
    }

    if (netBaseTransfer.gt(0)) {
      this.baseToken.transfer = netBaseTransfer
    } else {
      this.baseToken.receive = netBaseTransfer.abs()
    }

    this.__params = {
      optionMarket: market.address,
      strikeId: BigNumber.from(strike.id),
      positionId: position ? BigNumber.from(position.id) : ZERO_BN,
      iterations: BigNumber.from(iterations),
      setCollateralTo: this.collateral?.amount ?? ZERO_BN,
      currentCollateral: position?.collateral?.amount ?? ZERO_BN,
      optionType: getOptionType(option.isCall, this.isLong, !!isBaseCollateral),
      amount: size,
      minCost: !isBuy && minOrMaxPremium.gt(ZERO_BN) ? minOrMaxPremium : ZERO_BN,
      maxCost: isBuy ? minOrMaxPremium : MAX_BN,
      inputAmount:
        inputAsset && inputAsset.decimals !== 18
          ? from18DecimalBN(this.quoteToken.transfer, inputAsset.decimals)
          : this.quoteToken.transfer,
      inputAsset: this.quoteToken.address,
    }

    this.isCollateralUpdate = !!(this.collateral && this.size.isZero() && this.collateral.amount.gt(0))

    const wrapper = getLyraContract(lyra, LyraContractId.OptionMarketWrapper)
    const stables = options?.stables ?? []
    const roundedInputAmount = roundToDp(this.quoteToken.transfer, 1)
    const roundedMaxCost = roundToDp(BigNumber.from(this.__params.maxCost), 1)
    const isSwap = inputAsset && inputAsset.address !== this.market().quoteToken.address
    // Check if input fields (collateral and size) are 8dp
    // For a stable swapped trade, can't pack equivalent rounded inputs (no slippage tolerance for Curve swap)
    const wrapperMarketId = option.market().__wrapperMarketId
    const isPackable =
      wrapperMarketId !== null &&
      !isNDecimalPlaces(size, 9) &&
      (!this.collateral || !isNDecimalPlaces(this.collateral.amount, 9)) &&
      (!isSwap || !roundedInputAmount.eq(roundedMaxCost))

    this.__calldata = isPackable
      ? getPackedTradeCalldata(
          this.lyra,
          wrapperMarketId,
          {
            option,
            isOpen: this.isOpen,
            isLong: this.isLong,
            size,
            newSize: this.newSize,
            inputAmount: from18DecimalBN(roundedInputAmount, inputAsset?.decimals ?? 18),
            maxCost: roundedMaxCost,
            minCost: roundToDp(BigNumber.from(this.__params.minCost), 1, { ceil: false }),
            iterations,
            isForceClose: this.isForceClose,
            stables,
            collateral: this.collateral,
            position,
          },
          {
            inputAsset: inputAsset ? { address: inputAsset?.address, decimals: inputAsset?.decimals } : undefined,
          }
        )
      : wrapper.interface.encodeFunctionData(
          // Type-hack since all args are the same
          (this.isOpen || this.isCollateralUpdate
            ? 'openPosition'
            : !this.isForceClose
            ? 'closePosition'
            : 'forceClosePosition') as 'openPosition',
          [this.__params]
        )

    // TODO: @dappbeast Pass individual args instead of "this" to constructor
    this.disabledReason = getTradeDisabledReason(quote, this)
    this.isDisabled = !!this.disabledReason
    this.tx = buildTx(lyra, wrapper.address, owner, this.__calldata)
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
    options?: TradeOptions
  ): Promise<Trade> {
    const maybeGetPosition = async (): Promise<Position | undefined> => {
      if (options?.positionId) {
        return await Position.get(lyra, marketAddressOrName, options.positionId)
      }
      return
    }

    const [market, position, balances] = await Promise.all([
      Market.get(lyra, marketAddressOrName),
      maybeGetPosition(),
      lyra.account(owner).marketBalances(marketAddressOrName),
    ])
    let supportedInputAsset: AccountQuoteBalance | null = null
    const { quoteSwapAssets: supportedAssets } = balances
    const inputAddress = options?.inputAsset?.address
    if (inputAddress) {
      supportedInputAsset =
        supportedAssets.find(
          stable => stable.address === inputAddress || stable.symbol.toLowerCase() === inputAddress.toLowerCase()
        ) ?? null
    }

    let swapRate = ONE_BN
    if (supportedInputAsset && supportedInputAsset.address !== market.quoteToken.address) {
      const fromToken = isBuy || options?.setToCollateral ? supportedInputAsset : market.quoteToken
      const toToken = isBuy || options?.setToCollateral ? market.quoteToken : supportedInputAsset
      // Throws if stable not supported
      swapRate = to18DecimalBN(
        await getSwapQuote(lyra, fromToken?.address, toToken?.address, from18DecimalBN(ONE_BN, fromToken.decimals)),
        toToken.decimals
      )
    }
    if (options?.inputAsset?.address && !supportedInputAsset) {
      throw new Error('Input asset not supported')
    }
    const option = market.liveOption(strikeId, isCall)
    const trade = new Trade(lyra, owner, option, isBuy, size, {
      ...options,
      position,
      swapRate: fromBigNumber(swapRate),
      inputAsset: supportedInputAsset
        ? {
            address: supportedInputAsset.address,
            decimals: supportedInputAsset.decimals,
          }
        : undefined,
      stables: supportedAssets,
    })

    // Insufficient balance early return
    if (
      trade &&
      trade.tx &&
      supportedInputAsset &&
      supportedInputAsset.balance.lt(from18DecimalBN(trade.quoteToken.transfer, supportedInputAsset.decimals))
    ) {
      return trade
    }

    const to = trade.tx.to
    const from = trade.tx.from
    const data = trade.tx.data
    if (!to || !from || !data) {
      throw new Error('Missing tx data')
    }

    try {
      trade.tx = await buildTxWithGasEstimate(lyra, to, from, data)
    } catch (e) {
      console.error('Error estimating gas for trade: ', e)
    }
    return trade
  }

  static getSync(
    lyra: Lyra,
    owner: string,
    option: Option,
    isBuy: boolean,
    size: BigNumber,
    options?: TradeOptionsSync
  ): Trade {
    return new Trade(lyra, owner, option, isBuy, size, options)
  }

  // Helper Functions

  static getMinCollateral(option: Option, size: BigNumber, isBaseCollateral: boolean): BigNumber {
    return getMinCollateralForSpotPrice(option, size, option.market().spotPrice, isBaseCollateral)
  }

  static getLiquidationPrice(
    option: Option,
    size: BigNumber,
    collateralAmount: BigNumber,
    isBaseCollateral?: boolean
  ): BigNumber | null {
    return getLiquidationPrice(option, size, collateralAmount, isBaseCollateral)
  }

  static getPositionIdsForLogs(logs: Log[]): number[] {
    const trades = parsePartialTradeEventsFromLogs(logs)
    const updates = parsePartialPositionUpdatedEventsFromLogs(logs)
    const positionIds = [
      ...trades.map(t => t.args.positionId.toNumber()),
      ...updates.map(u => u.args.positionId.toNumber()),
    ]
    return Array.from(new Set(positionIds))
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
}
