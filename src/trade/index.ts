import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { TransactionReceipt } from '@ethersproject/providers'

import { AccountStableBalance } from '..'
import getAccountBalancesAndAllowances from '../account/getAccountBalancesAndAllowances'
import { Board } from '../board'
import { CollateralUpdateEvent } from '../collateral_update_event'
import { MAX_BN, UNIT, ZERO_ADDRESS, ZERO_BN } from '../constants/bn'
import {
  CURVE_POOL_FEE_RATE,
  DataSource,
  DEFAULT_ITERATIONS,
  DEFAULT_SWAP_SLIPPAGE,
  LyraContractId,
} from '../constants/contracts'
import { OptionMarketWrapperWithSwaps } from '../contracts/typechain/OptionMarketWrapper'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { Quote, QuoteDisabledReason, QuoteFeeComponents, QuoteGreeks, QuoteIteration } from '../quote'
import { Strike } from '../strike'
import { TradeEvent } from '../trade_event'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import { from18DecimalBN } from '../utils/convertBNDecimals'
import fromBigNumber from '../utils/fromBigNumber'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getBreakEvenPrice from '../utils/getBreakEvenPrice'
import getLyraContract from '../utils/getLyraContract'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'
import getOptionType from '../utils/getOptionType'
import getSettlePnl from '../utils/getSettlePnl'
import getTradeRealizedPnl from '../utils/getTradeRealizedPnl'
import getTradeRealizedPnlPercent from '../utils/getTradeRealizedPnlPercent'
import toBigNumber from '../utils/toBigNumber'
import getTradeCollateral from './getTradeCollateral'
import getTradeDisabledReason from './getTradeDisabledReason'

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
  inputAssetAddressOrName?: string
  swapSlippage?: number
}

export type TradeOptionsSync = {
  position?: Position
  inputAsset?: {
    address: string
    decimals: number
  }
} & Omit<TradeOptions, 'positionId' | 'inputAsset'>

export type TradeToken = {
  address: string
  transfer: BigNumber
  receive: BigNumber
}

export class Trade {
  // TODO: Use variables
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
  breakEven: BigNumber
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
      swapSlippage = DEFAULT_SWAP_SLIPPAGE,
      inputAsset,
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

    let quote = Quote.get(option, this.isBuy, this.size, {
      iterations,
    })

    if (
      !this.isOpen &&
      (quote.disabledReason === QuoteDisabledReason.DeltaOutOfRange ||
        quote.disabledReason === QuoteDisabledReason.TradingCutoff)
    ) {
      // Retry quote with force close flag
      quote = Quote.get(option, this.isBuy, this.size, {
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
    this.breakEven = getBreakEvenPrice(option.isCall, strike.strikePrice, quote.pricePerOption, isBaseCollateral)
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
      // Set swap fee to an estimate of premium
      // Based on curve pool fee and configured slippage
      this.externalSwapFee = netQuoteTransfer
        .abs()
        .mul(toBigNumber(CURVE_POOL_FEE_RATE + swapSlippage))
        .div(UNIT)

      this.premium = this.premium
        .mul(toBigNumber(isBuy ? 1 + CURVE_POOL_FEE_RATE + swapSlippage : 1 - CURVE_POOL_FEE_RATE + swapSlippage))
        .div(UNIT)
      this.pricePerOption = this.pricePerOption
        .mul(toBigNumber(isBuy ? 1 + CURVE_POOL_FEE_RATE + swapSlippage : 1 - CURVE_POOL_FEE_RATE + swapSlippage))
        .div(UNIT)
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

    const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)

    this.__calldata = wrapper.interface.encodeFunctionData(
      // Type-hack since all args are the same
      (this.isOpen || this.isCollateralUpdate
        ? 'openPosition'
        : !this.isForceClose
        ? 'closePosition'
        : 'forceClosePosition') as 'openPosition',
      [this.__params]
    )

    // TODO: @earthtojake Pass individual args instead of "this" to constructor
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
      getAccountBalancesAndAllowances(lyra, ZERO_ADDRESS),
    ])
    let supportedInputAsset: AccountStableBalance | null = null
    if (options?.inputAssetAddressOrName) {
      const stable = balances.stables.find(
        stable =>
          stable.address === options.inputAssetAddressOrName ||
          stable.symbol.toLowerCase() === options.inputAssetAddressOrName?.toLowerCase()
      )
      supportedInputAsset = stable ?? null
    }

    if (options?.inputAssetAddressOrName && !supportedInputAsset) {
      throw new Error('Input asset not supported')
    }

    const option = market.liveOption(strikeId, isCall)
    const trade = Trade.getSync(lyra, owner, option, isBuy, size, {
      ...options,
      position,
      inputAsset: supportedInputAsset
        ? {
            address: supportedInputAsset.address,
            decimals: supportedInputAsset.decimals,
          }
        : undefined,
    })

    const to = trade.tx.to
    const from = trade.tx.from
    const data = trade.tx.data
    if (!to || !from || !data) {
      throw new Error('Missing tx data')
    }

    trade.tx = await buildTxWithGasEstimate(lyra, to, from, data)

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

  // TODO: @earthtojake Support liquidations with multiple Trade/Collateral results
  static async getResult(lyra: Lyra, transactionHash: string): Promise<TradeEvent | CollateralUpdateEvent> {
    try {
      return (await TradeEvent.getByHash(lyra, transactionHash))[0]
    } catch (e) {
      return (await CollateralUpdateEvent.getByHash(lyra, transactionHash))[0]
    }
  }

  // TODO: @earthtojake Support liquidations with multiple Trade/Collateral results
  static getResultSync(lyra: Lyra, option: Option, receipt: TransactionReceipt): TradeEvent | CollateralUpdateEvent {
    try {
      return TradeEvent.getByLogsSync(lyra, option.market(), receipt.logs)[0]
    } catch (e) {
      return CollateralUpdateEvent.getByLogsSync(lyra, option, receipt.logs)[0]
    }
  }

  static getMinCollateral(option: Option, size: BigNumber, isBaseCollateral: boolean): BigNumber {
    return getMinCollateralForSpotPrice(option, size, option.market().spotPrice, isBaseCollateral)
  }

  // Dynamic fields

  realizedPnl(): BigNumber {
    const position = this.__position
    return position ? getTradeRealizedPnl(position, this) : ZERO_BN
  }

  realizedPnlPercent(): BigNumber {
    const position = this.__position
    return position ? getTradeRealizedPnlPercent(position, this) : ZERO_BN
  }

  newAvgCostPerOption(): BigNumber {
    const position = this.__position
    const trades = position ? (position.trades() as (TradeEvent | Trade)[]).concat([this]) : [this]
    return getAverageCostPerOption(trades)
  }

  prevAvgCostPerOption(): BigNumber {
    const position = this.__position
    return position ? getAverageCostPerOption(position.trades()) : ZERO_BN
  }

  payoff(spotPriceAtExpiry: BigNumber): BigNumber {
    return getSettlePnl(
      this.isLong,
      this.option().isCall,
      this.strike().strikePrice,
      spotPriceAtExpiry,
      this.newAvgCostPerOption(),
      this.newSize,
      this.collateral?.liquidationPrice,
      this.collateral && this.collateral.isBase
        ? // TODO: @earthtojake Use rolling average spot price
          { collateral: this.collateral.amount, avgSpotPrice: this.market().spotPrice }
        : undefined
    )
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
