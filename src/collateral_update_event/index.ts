import { BigNumber } from '@ethersproject/bignumber'
import { Log } from '@ethersproject/providers'

import { Board } from '../board'
import { DataSource, POSITION_UPDATED_TYPES, PositionUpdatedType } from '../constants/contracts'
import { PartialCollateralUpdateEventGroup } from '../constants/events'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { Strike } from '../strike'
import { TradeEvent, TradeEventData } from '../trade_event'
import fetchPositionEventsByOwner from '../utils/fetchPositionEventsByOwner'
import getCollateralUpdateDataFromEvent from '../utils/getCollateralUpdateDataFromEvent'
import getIsCall from '../utils/getIsCall'
import getIsLong from '../utils/getIsLong'
import getMarketAddresses from '../utils/getMarketAddresses'
import getTradeDataFromEvent from '../utils/getTradeDataFromEvent'
import parsePartialPositionUpdatedEventsFromLogs from '../utils/parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventFromLogs from '../utils/parsePartialTradeEventsFromLogs'
import parsePartialTransferEventsFromLogs from '../utils/parsePartialTransferEventsFromLogs'
import sortEvents, { SortEventOptions } from '../utils/sortEvents'

export type CollateralUpdateData = {
  owner: string
  timestamp: number
  transactionHash: string
  positionId: number
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  strikeId: number
  strikePrice: BigNumber
  blockNumber: number
  setCollateralTo: BigNumber
  isBaseCollateral: boolean
  isCall: boolean
}

export class CollateralUpdateEvent {
  private lyra: Lyra
  private __collateralUpdateData: CollateralUpdateData
  private __tradeData?: TradeEventData
  __source: DataSource
  owner: string
  timestamp: number
  transactionHash: string
  positionId: number
  marketAddress: string
  marketName: string
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  blockNumber: number
  setCollateralTo: BigNumber
  isBaseCollateral: boolean
  isCall: boolean
  isAdjustment: boolean

  constructor(lyra: Lyra, source: DataSource, update: CollateralUpdateData, trade?: TradeEventData) {
    this.lyra = lyra
    this.__collateralUpdateData = update
    this.__tradeData = trade
    this.__source = source
    this.owner = update.owner
    this.timestamp = update.timestamp
    this.transactionHash = update.transactionHash
    this.positionId = update.positionId
    this.blockNumber = update.blockNumber
    this.marketAddress = update.marketAddress
    this.expiryTimestamp = update.expiryTimestamp
    this.setCollateralTo = update.setCollateralTo
    this.marketName = update.marketName
    this.strikeId = update.strikeId
    this.strikePrice = update.strikePrice
    this.isCall = update.isCall
    this.isBaseCollateral = update.isBaseCollateral
    this.isAdjustment = !trade
  }

  // Getters

  static async getByHash(lyra: Lyra, transactionHash: string): Promise<CollateralUpdateEvent[]> {
    const receipt = await lyra.provider.getTransactionReceipt(transactionHash)
    const collateralAdjustedEvent = parsePartialPositionUpdatedEventsFromLogs(receipt.logs).find(
      e => e.args.updatedType === PositionUpdatedType.Adjusted
    )
    if (!collateralAdjustedEvent) {
      throw new Error('No CollateralUpdate event in transaction')
    }
    const { address } = collateralAdjustedEvent
    const marketAddresses = (await getMarketAddresses(lyra)).find(
      marketAddresses => marketAddresses.optionToken === address
    )
    if (!marketAddresses) {
      throw new Error('Transaction hash does not exist for OptionToken contract')
    }
    const marketAddress = marketAddresses.optionMarket
    const market = await Market.get(lyra, marketAddress)
    const option = await market.option(
      collateralAdjustedEvent.args.position.strikeId.toNumber(),
      getIsCall(collateralAdjustedEvent.args.position.optionType)
    )
    return CollateralUpdateEvent.getByLogsSync(lyra, option, receipt.logs)
  }

  static getByLogsSync(lyra: Lyra, option: Option, logs: Log[]): CollateralUpdateEvent[] {
    const updates = parsePartialPositionUpdatedEventsFromLogs(logs).filter(
      u => !getIsLong(u.args.position.optionType) && POSITION_UPDATED_TYPES.includes(u.args.updatedType)
    )

    if (updates.length === 0) {
      throw []
    }

    const eventsByPositionID: Record<number, PartialCollateralUpdateEventGroup> = {}

    const trades = parsePartialTradeEventFromLogs(logs)
    const transfers = parsePartialTransferEventsFromLogs(logs)

    updates.forEach(collateralUpdate => {
      const id = collateralUpdate.args.positionId.toNumber()
      eventsByPositionID[id] = { collateralUpdate, transfers: [] }
    })
    transfers.forEach(transfer => {
      const id = transfer.args.tokenId.toNumber()
      if (eventsByPositionID[id]) {
        eventsByPositionID[id].transfers.push(transfer)
      }
    })
    trades.forEach(trade => {
      const id = trade.args.positionId.toNumber()
      if (eventsByPositionID[id]) {
        eventsByPositionID[id].trade = trade
      }
    })

    return Object.values(eventsByPositionID).map(
      ({ collateralUpdate: collateralUpdateEvent, trade: tradeEvent, transfers: transferEvents }) => {
        const update = getCollateralUpdateDataFromEvent(collateralUpdateEvent, option, transferEvents)
        const trade = tradeEvent ? getTradeDataFromEvent(option.market(), tradeEvent, transferEvents) : undefined
        return new CollateralUpdateEvent(lyra, DataSource.Log, update, trade)
      }
    )
  }

  static async getByOwner(lyra: Lyra, owner: string, options?: SortEventOptions): Promise<CollateralUpdateEvent[]> {
    const events = await fetchPositionEventsByOwner(lyra, owner)
    return sortEvents(
      events.collateralUpdates.map(
        collateralUpdate =>
          new CollateralUpdateEvent(
            lyra,
            DataSource.Subgraph,
            collateralUpdate,
            events.trades.find(t => t.transactionHash === collateralUpdate.transactionHash)
          )
      ),
      options
    )
  }

  // Edges

  trade(): TradeEvent | null {
    if (!this.__tradeData) {
      return null
    }
    return new TradeEvent(this.lyra, this.__source, this.__tradeData, this.__collateralUpdateData)
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
}
