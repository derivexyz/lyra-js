import { TransactionReceipt } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'

import Lyra from '..'
import Board from '../board'
import CollateralUpdateEvent from '../collateral_update_event'
import { MAX_BN, UNIT, ZERO_BN } from '../constants/bn'
import { DataSource, DEFAULT_ITERATIONS, LyraContractId } from '../constants/contracts'
import { OptionMarketWrapper } from '../contracts/typechain'
import Market from '../market'
import Option from '../option'
import Position from '../position'
import Quote, { QuoteDisabledReason, QuoteFeeComponents, QuoteGreeks, QuoteIteration } from '../quote'
import Strike from '../strike'
import TradeEvent from '../trade_event'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fromBigNumber from '../utils/fromBigNumber'
import getLyraContract from '../utils/getLyraContract'
import getOptionType from '../utils/getOptionType'
import toBigNumber from '../utils/toBigNumber'
import getTradeCollateral, { TradeCollateral } from './getTradeCollateral'
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
  PositionWrongOwner = 'PositionWrongOwner',
  PositionClosed = 'PositionClosed',
  PositionNotLargeEnough = 'PositionNotLargeEnough',
  PositionClosedLeftoverCollateral = 'PositionClosedLeftoverCollateral',
}

export type TradeOptions = {
  positionId?: number
  premiumSlippage?: number
  minOrMaxPremium?: BigNumber
  setToCollateral?: BigNumber
  isBaseCollateral?: boolean
  iterations?: number
  useFullCollateral?: boolean
  usePositionCollateralRatio?: boolean
  minCollateralBuffer?: number
  maxCollateralBuffer?: number
}

export type TradeOptionsSync = {
  position?: Position
} & Omit<TradeOptions, 'positionId'>

export type TradeToken = {
  address: string
  transfer: BigNumber
  receive: BigNumber
}

export default class Trade {
  private lyra: Lyra
  private __option: Option
  private __position?: Position
  __source = DataSource.ContractCall

  isBuy: boolean
  isOpen: boolean
  owner: string
  size: BigNumber
  newSize: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  quoted: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  collateral?: TradeCollateral
  iv: BigNumber
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

  tx: ethers.PopulatedTransaction | null
  iterations: QuoteIteration[]
  __params: OptionMarketWrapper.OptionPositionParamsStruct | null
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
      minOrMaxPremium: _minOrMaxPremium,
      iterations = DEFAULT_ITERATIONS,
      isBaseCollateral: _isBaseCollateral,
      useFullCollateral,
      usePositionCollateralRatio,
      minCollateralBuffer,
      maxCollateralBuffer,
    } = options ?? {}

    this.__option = option
    this.__position = position
    const strike = option.strike()
    const market = option.market()

    // References
    this.lyra = lyra

    // Check if opening or closing active position
    this.isBuy = isBuy
    this.isOpen = position ? (isBuy && position.isLong) || (!isBuy && !position.isLong) : true
    this.owner = owner
    const isLong = position ? position.isLong : isBuy
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
    this.greeks = quote.greeks
    this.fee = quote.fee
    this.feeComponents = quote.feeComponents
    this.forceClosePenalty = quote.forceClosePenalty
    this.breakEven = quote.breakEven
    this.iterations = quote.iterations

    // Initialize tokens
    this.quoteToken = {
      // TODO: @michaelxuwu Support multiple stables
      address: market.quoteToken.address,
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
      // If proposed collateral is valid
      const currentCollateral = position && position.collateral ? position.collateral.amount : ZERO_BN

      this.collateral = getTradeCollateral({
        option: option,
        prevTradeSize: position?.size ?? ZERO_BN,
        postTradeSize: this.newSize,
        currentCollateral,
        setToCollateral,
        minCollateralBuffer,
        maxCollateralBuffer,
        isBaseCollateral,
        useFullCollateral,
        usePositionCollateralRatio,
      })

      // Get collateral change
      const collateralDiff = this.collateral.amount.sub(this.collateral.current)

      if (this.collateral.isBase) {
        netBaseTransfer = netBaseTransfer.add(collateralDiff)
      } else {
        netQuoteTransfer = netQuoteTransfer.add(collateralDiff)
      }
    }

    // TODO: @michaelxuwu Account for stablecoin slippage
    if (netQuoteTransfer.gt(0)) {
      this.quoteToken.transfer = netQuoteTransfer
    } else {
      this.quoteToken.receive = netQuoteTransfer.abs()
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
      currentCollateral: this.collateral?.current ?? ZERO_BN,
      optionType: getOptionType(option.isCall, isLong, !!isBaseCollateral),
      amount: size,
      minCost: !isBuy ? minOrMaxPremium : ZERO_BN,
      maxCost: isBuy ? minOrMaxPremium : MAX_BN,
      stableAmount: this.quoteToken.transfer,
      stableAsset: this.quoteToken.address,
    }

    this.isCollateralUpdate = !!(this.collateral && this.size.isZero() && this.collateral.amount.gt(0))

    const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
    this.__calldata = wrapper.interface.encodeFunctionData(
      // Type-hack since all args are the same
      (this.isOpen ? 'openPosition' : !this.isForceClose ? 'closePosition' : 'forceClosePosition') as 'openPosition',
      [this.__params]
    )

    // TODO: @earthtojake Pass individual args instead of "this" to constructor
    this.disabledReason = getTradeDisabledReason(quote, this)
    this.isDisabled = !!this.disabledReason
    this.tx = !this.isDisabled ? buildTx(lyra, wrapper.address, owner, this.__calldata) : null
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
    const [market, position] = await Promise.all([Market.get(lyra, marketAddressOrName), maybeGetPosition()])
    const option = market.liveOption(strikeId, isCall)
    const trade = Trade.getSync(lyra, owner, option, isBuy, size, { ...options, position })
    trade.tx =
      trade.tx && trade.tx.to && trade.tx.from && trade.tx.data
        ? await buildTxWithGasEstimate(lyra, trade.tx.to, trade.tx.from, trade.tx.data)
        : null
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

  static async getResult(lyra: Lyra, transactionHash: string): Promise<TradeEvent | CollateralUpdateEvent> {
    try {
      return await TradeEvent.getByHash(lyra, transactionHash)
    } catch (e) {
      return await CollateralUpdateEvent.getByHash(lyra, transactionHash)
    }
  }

  static getResultSync(
    lyra: Lyra,
    option: Option,
    receipt: TransactionReceipt,
    timestamp: number
  ): TradeEvent | CollateralUpdateEvent {
    try {
      return TradeEvent.getByReceiptSync(lyra, option.market(), receipt, timestamp)
    } catch (e) {
      return CollateralUpdateEvent.getByReceiptSync(lyra, option, receipt, timestamp)
    }
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
