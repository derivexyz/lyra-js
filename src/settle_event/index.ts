import { BigNumber } from '@ethersproject/bignumber'
import { TransactionReceipt } from '@ethersproject/providers'

import Lyra, { Position } from '..'
import { DataSource } from '../constants/contracts'
import fetchPositionEventDataByHash from '../utils/fetchPositionEventDataByHash'

export type SettleEventData = {
  source: DataSource
  blockNumber: number
  timestamp: number
  transactionHash: string
  positionId: number
  spotPriceAtExpiry: BigNumber
  owner: string
  size: BigNumber
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  strikePrice: BigNumber
  isCall: boolean
  isLong: boolean
  isBaseCollateral: boolean
  settlement: BigNumber
  returnedCollateralAmount: BigNumber
  returnedCollateralValue: BigNumber
  isInTheMoney: boolean
}

export class SettleEvent {
  private __settleData: SettleEventData
  __source: DataSource
  lyra: Lyra
  blockNumber: number
  positionId: number
  spotPriceAtExpiry: BigNumber
  timestamp: number
  transactionHash: string
  owner: string
  size: BigNumber
  marketName: string
  marketAddress: string
  expiryTimestamp: number
  strikePrice: BigNumber
  isCall: boolean
  isLong: boolean
  isBaseCollateral: boolean
  settlement: BigNumber
  returnedCollateralAmount: BigNumber
  returnedCollateralValue: BigNumber
  isInTheMoney: boolean

  constructor(lyra: Lyra, settle: SettleEventData) {
    this.lyra = lyra
    this.__settleData = settle
    this.__source = settle.source
    this.blockNumber = settle.blockNumber
    this.positionId = settle.positionId
    this.spotPriceAtExpiry = settle.spotPriceAtExpiry
    this.timestamp = settle.timestamp
    this.transactionHash = settle.transactionHash
    this.owner = settle.owner
    this.size = settle.size
    this.marketName = settle.marketName
    this.blockNumber = settle.blockNumber
    this.marketAddress = settle.marketAddress
    this.expiryTimestamp = settle.expiryTimestamp
    this.isCall = settle.isCall
    this.isLong = settle.isLong
    this.isBaseCollateral = settle.isBaseCollateral
    this.strikePrice = settle.strikePrice
    this.settlement = settle.settlement
    this.returnedCollateralAmount = settle.returnedCollateralAmount
    this.returnedCollateralValue = settle.returnedCollateralValue
    this.isInTheMoney = settle.isInTheMoney
  }

  // Getters

  static async getByHash(lyra: Lyra, transactionHashOrReceipt: string | TransactionReceipt): Promise<SettleEvent[]> {
    const { settles } = await fetchPositionEventDataByHash(lyra, transactionHashOrReceipt)
    return settles
  }

  // Dynamic Fields

  pnl(position: Position): BigNumber {
    return position.pnl().settlementPnl
  }

  // Edges

  async position(): Promise<Position> {
    return await this.lyra.position(this.marketAddress, this.positionId)
  }
}
