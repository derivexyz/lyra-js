import { BigNumber } from '@ethersproject/bignumber'
import { TransactionReceipt } from '@ethersproject/providers'

import { Board } from '../board'
import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { Strike } from '../strike'
import { TradeEvent, TradeEventData } from '../trade_event'
import fetchPositionEventDataByHash from '../utils/fetchPositionEventDataByHash'
import getAverageCollateralSpotPrice from '../utils/getAverageCollateralSpotPrice'
import getCollateralUpdatePnl from '../utils/getCollateralUpdatePnl'

export type CollateralUpdateData = {
  owner: string
  source: DataSource
  timestamp: number
  transactionHash: string
  positionId: number
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  strikeId: number
  strikePrice: BigNumber
  blockNumber: number
  amount: BigNumber
  value: BigNumber
  isBaseCollateral: boolean
  isCall: boolean
  spotPrice: BigNumber
  swap?: {
    address: string
  }
}

export class CollateralUpdateEvent {
  private __collateralUpdateData: CollateralUpdateData
  private __tradeData?: TradeEventData
  __source: DataSource
  lyra: Lyra
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
  amount: BigNumber
  value: BigNumber
  isBaseCollateral: boolean
  isCall: boolean
  isAdjustment: boolean
  swap?: {
    address: string
  }
  spotPrice: BigNumber

  constructor(lyra: Lyra, update: CollateralUpdateData, trade?: TradeEventData) {
    this.lyra = lyra
    this.__collateralUpdateData = update
    this.__tradeData = trade
    this.__source = update.source
    this.owner = update.owner
    this.timestamp = update.timestamp
    this.transactionHash = update.transactionHash
    this.positionId = update.positionId
    this.blockNumber = update.blockNumber
    this.marketAddress = update.marketAddress
    this.expiryTimestamp = update.expiryTimestamp
    this.amount = update.amount
    this.value = update.value
    this.marketName = update.marketName
    this.strikeId = update.strikeId
    this.strikePrice = update.strikePrice
    this.isCall = update.isCall
    this.isBaseCollateral = update.isBaseCollateral
    this.spotPrice = update.spotPrice
    this.isAdjustment = !trade
    this.swap = update.swap
  }

  // Getters

  static async getByHash(
    lyra: Lyra,
    transactionHashOrReceipt: string | TransactionReceipt
  ): Promise<CollateralUpdateEvent[]> {
    const { collateralUpdates } = await fetchPositionEventDataByHash(lyra, transactionHashOrReceipt)
    return collateralUpdates
  }

  // Dynamic Fields

  pnl(position: Position): BigNumber {
    return getCollateralUpdatePnl(position, this)
  }

  prevAmount(position: Position): BigNumber {
    const prevCollateralUpdates = position.collateralUpdates().filter(c => c.blockNumber < this.blockNumber)
    const prevCollateralUpdate = prevCollateralUpdates.length
      ? prevCollateralUpdates[prevCollateralUpdates.length - 1]
      : null
    return prevCollateralUpdate?.amount ?? ZERO_BN
  }

  changeAmount(position: Position): BigNumber {
    const prevAmount = this.prevAmount(position)
    return this.amount.sub(prevAmount)
  }

  changeValue(position: Position): BigNumber {
    const changeAmount = this.changeAmount(position)
    return this.isBaseCollateral ? changeAmount.mul(this.spotPrice).div(UNIT) : changeAmount
  }

  newAverageCollateralSpotPrice(position: Position): BigNumber {
    // Include this event by block number
    const collateralUpdates = position.collateralUpdates().filter(c => c.blockNumber <= this.blockNumber)
    return getAverageCollateralSpotPrice(position, collateralUpdates)
  }

  prevAverageCollateralSpotPrice(position: Position): BigNumber {
    // Exclude this event by block number
    const collateralUpdates = position.collateralUpdates().filter(c => c.blockNumber < this.blockNumber)
    return getAverageCollateralSpotPrice(position, collateralUpdates)
  }

  // Edges

  trade(): TradeEvent | null {
    if (!this.__tradeData) {
      return null
    }
    return new TradeEvent(this.lyra, this.__tradeData, this.__collateralUpdateData)
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
