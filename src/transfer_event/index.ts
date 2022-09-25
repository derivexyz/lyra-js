import { TransactionReceipt } from '@ethersproject/providers'

import { DataSource } from '../constants/contracts'
import Lyra from '../lyra'
import fetchPositionEventDataByHash from '../utils/fetchPositionEventDataByHash'

export type TransferEventData = {
  transactionHash: string
  source: DataSource
  blockNumber: number
  from: string
  to: string
  positionId: number
}

export class TransferEvent {
  private lyra: Lyra
  private __transferData: TransferEventData
  __source: DataSource
  transactionHash: string
  blockNumber: number
  from: string
  to: string
  positionId: number

  constructor(lyra: Lyra, transfer: TransferEventData) {
    this.lyra = lyra
    this.__transferData = transfer
    this.__source = transfer.source
    this.transactionHash = transfer.transactionHash
    this.blockNumber = transfer.blockNumber
    this.from = transfer.from
    this.to = transfer.to
    this.positionId = transfer.positionId
  }

  // Getters

  static async getByHash(lyra: Lyra, transactionHashOrReceipt: string | TransactionReceipt): Promise<TransferEvent[]> {
    const { transfers } = await fetchPositionEventDataByHash(lyra, transactionHashOrReceipt)
    return transfers
  }
}
