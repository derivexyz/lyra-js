import { CollateralUpdateData } from '../collateral_update_event'
import { TradeEvent } from '../contracts/newport/typechain/OptionMarket'
import { PositionUpdatedEvent, TransferEvent } from '../contracts/newport/typechain/OptionToken'
import { SettleEventData } from '../settle_event'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'

export type PartialPositionUpdatedEvent = {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: PositionUpdatedEvent['args']
}

export type PartialTradeEvent = {
  address: string // OptionMarket
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: TradeEvent['args']
}

export type PartialTransferEvent = {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: TransferEvent['args']
}

export type PartialCollateralUpdateEventGroup = {
  collateralUpdate: PartialPositionUpdatedEvent
  trade?: PartialTradeEvent
  transfers: PartialTransferEvent[]
}

export type PartialTradeEventGroup = {
  trade: PartialTradeEvent
  collateralUpdate?: PartialPositionUpdatedEvent
  transfers: PartialTransferEvent[]
}

export type PositionEventData = {
  trades: TradeEventData[]
  collateralUpdates: CollateralUpdateData[]
  transfers: TransferEventData[]
  settle: SettleEventData | null
}
