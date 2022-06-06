import { DataSource } from '../constants/contracts'
import Lyra from '../lyra'

export type TransferEventData = {
  transactionHash: string
  blockNumber: number
  from: string
  to: string
}

export class TransferEvent {
  private lyra: Lyra
  private __transferData: TransferEventData
  __source: DataSource
  transactionHash: string
  blockNumber: number
  from: string
  to: string

  constructor(lyra: Lyra, source: DataSource, transfer: TransferEventData) {
    this.lyra = lyra
    this.__transferData = transfer
    this.__source = source
    this.transactionHash = transfer.transactionHash
    this.blockNumber = transfer.blockNumber
    this.from = transfer.from
    this.to = transfer.to
  }
}
