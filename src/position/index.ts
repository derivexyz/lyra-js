import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { CollateralUpdateData, CollateralUpdateEvent } from '../collateral_update_event'
import { ZERO_BN } from '../constants/bn'
import { DataSource, PositionState } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { SettleEvent, SettleEventData } from '../settle_event'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import { TradeEvent, TradeEventData } from '../trade_event'
import { TransferEvent, TransferEventData } from '../transfer_event'
import fetchOpenPositionDataByOwner from '../utils/fetchOpenPositionDataByOwner'
import fetchPositionDataByID from '../utils/fetchPositionDataByID'
import fetchPositionDataByOwner from '../utils/fetchPositionDataByOwner'
import getAverageCollateralSpotPrice from '../utils/getAverageCollateralSpotPrice'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getBreakEvenPrice from '../utils/getBreakEvenPrice'
import getProjectedSettlePnl from '../utils/getProjectedSettlePnl'
import { PositionCollateral } from './getPositionCollateral'
import getPositionPnl from './getPositionPnl'

export type PositionData = {
  source: DataSource
  market: Market
  id: number
  blockNumber: number
  marketName: string
  marketAddress: string
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  owner: string
  size: BigNumber
  isCall: boolean
  isLong: boolean
  collateral?: PositionCollateral
  state: PositionState
  isOpen: boolean
  isLiquidated: boolean
  isSettled: boolean
  pricePerOption: BigNumber
  spotPriceAtExpiry?: BigNumber
  isInTheMoney: boolean
  delta: BigNumber
  openTimestamp: number
  closeTimestamp?: number | null
  trades: TradeEventData[]
  collateralUpdates: CollateralUpdateData[]
  transfers: TransferEventData[]
  settle: SettleEventData | null
}

export type PositionPnl = {
  // Premiums paid / received for open portion of position
  totalAverageOpenCost: BigNumber
  // Premiums paid / received for closed portion of position
  totalAverageCloseCost: BigNumber
  // Unrealized profit / loss for open portion of position
  unrealizedPnl: BigNumber
  unrealizedPnlPercentage: BigNumber
  // Realized profit / loss for closed portion of position
  realizedPnl: BigNumber
  realizedPnlPercentage: BigNumber
  // Payoff for settlement
  settlementPnl: BigNumber
  settlementPnlPercentage: BigNumber
}

export type PositionTradeOptions = Omit<TradeOptions, 'positionId'>

export class Position {
  private __positionData: PositionData
  __source: DataSource
  lyra: Lyra
  id: number
  marketName: string
  marketAddress: string
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  owner: string
  size: BigNumber
  isCall: boolean
  isLong: boolean
  collateral?: PositionCollateral
  state: PositionState
  isOpen: boolean
  isLiquidated: boolean
  isSettled: boolean
  pricePerOption: BigNumber
  spotPriceAtExpiry?: BigNumber
  isInTheMoney: boolean
  delta: BigNumber
  openTimestamp: number
  closeTimestamp?: number | null

  constructor(lyra: Lyra, position: PositionData) {
    this.lyra = lyra
    this.__positionData = position
    this.__source = position.source
    this.owner = position.owner
    this.id = position.id
    this.strikeId = position.strikeId
    this.strikePrice = position.strikePrice
    this.expiryTimestamp = position.expiryTimestamp
    this.marketName = position.marketName
    this.marketAddress = position.marketAddress
    this.isCall = position.isCall
    this.isLong = position.isLong
    this.state = position.state
    this.isOpen = position.isOpen
    this.size = position.size
    this.isLiquidated = position.isLiquidated
    this.isSettled = position.isSettled
    this.collateral = position.collateral
    this.pricePerOption = position.pricePerOption
    this.spotPriceAtExpiry = position.spotPriceAtExpiry
    this.isInTheMoney = position.isInTheMoney
    this.delta = position.delta
    this.openTimestamp = position.openTimestamp
    this.closeTimestamp = position.closeTimestamp
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, positionId: number): Promise<Position> {
    const market = await Market.get(lyra, marketAddressOrName)
    const position = await fetchPositionDataByID(lyra, market, positionId)
    return new Position(lyra, position)
  }

  static async getOpenByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchOpenPositionDataByOwner(lyra, owner)
    return positions.map(position => new Position(lyra, position))
  }

  static async getByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchPositionDataByOwner(lyra, owner)
    return positions.map(position => new Position(lyra, position))
  }

  // Dynamic Fields

  sizeBeforeClose(): BigNumber {
    const lastTrade = this.lastTrade()
    if (!this.isOpen && this.size.isZero() && lastTrade) {
      // Position manually closed, use size before last trade
      return lastTrade.prevSize(this)
    } else {
      // Position may be settled or still open
      return this.size
    }
  }

  averageCostPerOption(): BigNumber {
    return getAverageCostPerOption(this.trades())
  }

  averageCollateralSpotPrice(): BigNumber {
    return getAverageCollateralSpotPrice(this, this.collateralUpdates())
  }

  pnl(): PositionPnl {
    return getPositionPnl(this)
  }

  breakEven(): BigNumber {
    return getBreakEvenPrice(this.isCall, this.strikePrice, this.averageCostPerOption())
  }

  toBreakEven(): BigNumber {
    const breakEven = this.breakEven()
    const spotPrice = this.isOpen
      ? this.market().spotPrice
      : this.isSettled
      ? this.spotPriceAtExpiry ?? ZERO_BN
      : this.lastTrade()?.spotPrice ?? ZERO_BN
    const breakEvenDiff = breakEven.sub(spotPrice)
    const toBreakEven = this.isCall
      ? spotPrice.gt(breakEven)
        ? ZERO_BN
        : breakEvenDiff
      : spotPrice.lt(breakEven)
      ? ZERO_BN
      : breakEvenDiff
    return toBreakEven
  }

  payoff(spotPriceAtExpiry: BigNumber): BigNumber {
    return getProjectedSettlePnl(
      this.isLong,
      this.isCall,
      this.strikePrice,
      spotPriceAtExpiry,
      this.averageCostPerOption(),
      this.sizeBeforeClose(),
      this.collateral?.liquidationPrice
    )
  }

  // Edges

  trades(): TradeEvent[] {
    const { trades, collateralUpdates } = this.__positionData
    const collateralUpdatesByHash: Record<string, CollateralUpdateData> = collateralUpdates.reduce(
      (dict, update) => ({ ...dict, [update.transactionHash]: update }),
      {} as Record<string, CollateralUpdateData>
    )
    return trades.map(trade => new TradeEvent(this.lyra, trade, collateralUpdatesByHash[trade.transactionHash]))
  }

  firstTrade(): TradeEvent | null {
    const trades = this.trades()
    return trades.length > 0 ? trades[0] : null
  }

  lastTrade(): TradeEvent | null {
    const trades = this.trades()
    return trades.length > 0 ? trades[trades.length - 1] : null
  }

  collateralUpdates(): CollateralUpdateEvent[] {
    const { trades, collateralUpdates } = this.__positionData
    const tradesByHash: Record<string, TradeEventData> = trades.reduce(
      (dict, trade) => ({ ...dict, [trade.transactionHash]: trade }),
      {} as Record<string, TradeEventData>
    )
    return collateralUpdates.map(
      collatUpdate => new CollateralUpdateEvent(this.lyra, collatUpdate, tradesByHash[collatUpdate.transactionHash])
    )
  }

  transfers(): TransferEvent[] {
    const { transfers } = this.__positionData
    return transfers.map(transferData => new TransferEvent(this.lyra, transferData))
  }

  settle(): SettleEvent | null {
    const { settle } = this.__positionData
    return settle ? new SettleEvent(this.lyra, settle) : null
  }

  market(): Market {
    return this.__positionData.market
  }

  async board(): Promise<Board> {
    return (await this.strike()).board()
  }

  async strike(): Promise<Strike> {
    return this.market().strike(this.strikeId)
  }

  liveStrike(): Strike {
    return this.market().liveStrike(this.strikeId)
  }

  async option(): Promise<Option> {
    return this.market().option(this.strikeId, this.isCall)
  }

  liveOption(): Option {
    return this.market().liveOption(this.strikeId, this.isCall)
  }

  // Trade

  async trade(isBuy: boolean, size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    return await Trade.get(
      this.lyra,
      this.owner,
      this.marketAddress,
      this.strikeId,
      this.isCall,
      isBuy,
      size,
      slippage,
      {
        positionId: this.id,
        ...options,
      }
    )
  }

  async open(size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    const isBuy = this.isLong
    return await this.trade(isBuy, size, slippage, options)
  }

  async close(size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    const isBuy = !this.isLong
    return await this.trade(isBuy, size, slippage, options)
  }
}
