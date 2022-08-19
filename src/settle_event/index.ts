import { BigNumber } from '@ethersproject/bignumber'

import Lyra, { CollateralUpdateData, Position, PositionData, TradeEventData } from '..'
import { DataSource } from '../constants/contracts'
import { PositionQueryResult } from '../constants/queries'
import getPositionSettlePnl from '../position/getPositionSettlePnl'
import fetchPositionEventsByOwner from '../utils/fetchPositionEventsByOwner'
import getCollateralUpdateDataFromSubgraph from '../utils/getCollateralUpdateDataFromSubgraph'
import getPositionDataFromSubgraph from '../utils/getPositionDataFromSubgraph'
import getTradeDataFromSubgraph from '../utils/getTradeDataFromSubgraph'
import sortEvents, { SortEventOptions } from '../utils/sortEvents'

export type SettleEventData = {
  blockNumber: number
  positionId: number
  pnl: BigNumber
  size: BigNumber
  spotPriceAtExpiry: BigNumber
  timestamp: number
  transactionHash: string
  owner: string
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  isCall: boolean
  strikePrice: BigNumber
  position: PositionQueryResult
}

export class SettleEvent {
  private lyra: Lyra
  private __settleData: SettleEventData

  position: Position
  __source: DataSource
  blockNumber: number
  positionId: number
  size: BigNumber
  spotPriceAtExpiry: BigNumber
  timestamp: number
  transactionHash: string
  owner: string
  marketName: string
  marketAddress: string
  strikePrice: BigNumber
  expiryTimestamp: number
  isCall: boolean

  constructor(
    lyra: Lyra,
    source: DataSource,
    settle: SettleEventData,
    position: PositionData,
    trades: TradeEventData[],
    collateralUpdates: CollateralUpdateData[]
  ) {
    this.lyra = lyra
    this.__source = source
    this.__settleData = settle
    this.blockNumber = settle.blockNumber
    this.positionId = settle.positionId

    this.size = settle.size
    this.spotPriceAtExpiry = settle.spotPriceAtExpiry
    this.timestamp = settle.timestamp
    this.transactionHash = settle.transactionHash
    this.owner = settle.owner
    this.marketName = settle.marketName
    this.blockNumber = settle.blockNumber
    this.marketAddress = settle.marketAddress
    this.expiryTimestamp = settle.expiryTimestamp
    this.isCall = settle.isCall
    this.strikePrice = settle.strikePrice
    this.position = new Position(lyra, source, position, trades, collateralUpdates, [])
  }

  static async getByOwner(lyra: Lyra, owner: string, options?: SortEventOptions): Promise<SettleEvent[]> {
    const events = await fetchPositionEventsByOwner(lyra, owner)

    return sortEvents(
      events.settles.map(settle => {
        const trades = settle.position.trades.map(getTradeDataFromSubgraph)
        const collateralUpdates = settle.position.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
        const positionData = getPositionDataFromSubgraph(settle.position, settle.blockNumber)
        return new SettleEvent(lyra, DataSource.Subgraph, settle, positionData, trades, collateralUpdates)
      }),
      options
    )
  }

  realizedPnl(): BigNumber {
    return getPositionSettlePnl(this.position)
  }
}
