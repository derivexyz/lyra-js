import { BigNumber } from '@ethersproject/bignumber'
import { BlockTag, TransactionReceipt } from '@ethersproject/providers'

import { Board } from '../board'
import { CollateralUpdateData, CollateralUpdateEvent } from '../collateral_update_event'
import { DataSource } from '../constants/contracts'
import { TradeEvent as ContractTradeEvent } from '../contracts/newport/typechain/OptionMarket'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { QuoteFeeComponents } from '../quote'
import { Strike } from '../strike'
import fetchPositionEventDataByHash from '../utils/fetchPositionEventDataByHash'
import fetchTradeListener from '../utils/fetchTradeListener'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getPositionPreviousTrades from '../utils/getPositionPreviousTrades'
import getTradePnl from '../utils/getTradePnl'
import getTradeEventNewSize from './getTradeEventNewSize'
import getTradeEventPreviousSize from './getTradeEventPreviousSize'

export type TradeLiquidation = ContractTradeEvent['args']['liquidation']

export type TradeEventData = {
  positionId: number
  source: DataSource
  marketName: string
  marketAddress: string
  blockNumber: number
  timestamp: number
  transactionHash: string
  trader: string
  size: BigNumber
  isCall: boolean
  isOpen: boolean
  isBuy: boolean
  isLong: boolean
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  spotPrice: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  iv: BigNumber
  skew: BigNumber
  baseIv: BigNumber
  volTraded: BigNumber
  collateralAmount?: BigNumber
  collateralValue?: BigNumber
  isBaseCollateral?: boolean
  isForceClose: boolean
  isLiquidation: boolean
  liquidation?: TradeLiquidation
  swap?: {
    fee: BigNumber
    address: string
  }
}

export type TradeEventListener = {
  off: () => void
}

export type TradeEventListenerCallback = (trade: TradeEvent) => void

export type TradeEventListenerOptions = {
  pollInterval?: number
  startBlockNumber?: BlockTag
}

export class TradeEvent {
  private lyra: Lyra
  private __tradeData: TradeEventData
  private __collateralUpdateData?: CollateralUpdateData
  __source: DataSource
  positionId: number
  marketName: string
  marketAddress: string
  blockNumber: number
  timestamp: number
  transactionHash: string
  trader: string
  size: BigNumber
  isCall: boolean
  isOpen: boolean
  isBuy: boolean
  isLong: boolean
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  spotPrice: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  iv: BigNumber
  volTraded: BigNumber
  skew: BigNumber
  baseIv: BigNumber
  externalSwapFee?: BigNumber
  externalSwapToken?: string
  collateralAmount?: BigNumber
  collateralValue?: BigNumber
  isBaseCollateral?: boolean
  isForceClose: boolean
  isLiquidation: boolean
  liquidation?: TradeLiquidation
  swap?: {
    fee: BigNumber
    address: string
  }

  constructor(lyra: Lyra, trade: TradeEventData, collateralUpdate?: CollateralUpdateData) {
    this.lyra = lyra
    this.__tradeData = trade
    if (!trade.isLong && collateralUpdate) {
      // Only set collateral update data for shorts
      this.__collateralUpdateData = collateralUpdate
    }
    this.__source = trade.source
    this.positionId = trade.positionId
    this.marketName = trade.marketName
    this.marketAddress = trade.marketAddress
    this.timestamp = trade.timestamp
    this.blockNumber = trade.blockNumber
    this.transactionHash = trade.transactionHash
    this.trader = trade.trader
    this.size = trade.size
    this.isCall = trade.isCall
    this.isOpen = trade.isOpen
    this.isBuy = trade.isBuy
    this.isLong = trade.isLong
    this.strikeId = trade.strikeId
    this.strikePrice = trade.strikePrice
    this.expiryTimestamp = trade.expiryTimestamp
    this.spotPrice = trade.spotPrice
    this.pricePerOption = trade.pricePerOption
    this.premium = trade.premium
    this.fee = trade.fee
    this.feeComponents = trade.feeComponents
    this.swap = trade.swap
    this.iv = trade.iv
    this.skew = trade.skew
    this.baseIv = trade.baseIv
    this.volTraded = trade.volTraded
    this.collateralAmount = trade.collateralAmount
    this.collateralValue = trade.collateralValue
    this.isBaseCollateral = trade.isBaseCollateral
    this.isForceClose = trade.isForceClose
    this.isLiquidation = trade.isLiquidation
    this.liquidation = trade.liquidation
  }

  // Getters

  static async getByHash(lyra: Lyra, transactionHashOrReceipt: string | TransactionReceipt): Promise<TradeEvent[]> {
    const { trades } = await fetchPositionEventDataByHash(lyra, transactionHashOrReceipt)
    return trades
  }

  // Dynamic fields

  pnl(position: Position): BigNumber {
    // Pnl based on premiums
    return getTradePnl(position, this)
  }

  newAverageCostPerOption(position: Position): BigNumber {
    return getAverageCostPerOption(getPositionPreviousTrades(position, this).concat([this]))
  }

  prevAverageCostPerOption(position: Position): BigNumber {
    return getAverageCostPerOption(getPositionPreviousTrades(position, this))
  }

  newSize(position: Position): BigNumber {
    return getTradeEventNewSize(position, this)
  }

  prevSize(position: Position): BigNumber {
    return getTradeEventPreviousSize(position, this)
  }

  // Edges

  collateralUpdate(): CollateralUpdateEvent | null {
    if (!this.__collateralUpdateData) {
      return null
    }
    return new CollateralUpdateEvent(this.lyra, this.__collateralUpdateData, this.__tradeData)
  }

  async position(): Promise<Position> {
    return await Position.get(this.lyra, this.marketAddress, this.positionId)
  }

  async option(): Promise<Option> {
    return await Option.get(this.lyra, this.marketAddress, this.strikeId, this.isCall)
  }

  async strike(): Promise<Strike> {
    return await Strike.get(this.lyra, this.marketAddress, this.strikeId)
  }

  async board(): Promise<Board> {
    return (await this.strike()).board()
  }

  async market(): Promise<Market> {
    return await Market.get(this.lyra, this.marketAddress)
  }

  // Listeners

  static on(lyra: Lyra, callback: TradeEventListenerCallback, options?: TradeEventListenerOptions): TradeEventListener {
    return fetchTradeListener(lyra, callback, options)
  }
}
