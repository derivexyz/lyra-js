import { CollateralUpdateData } from '../collateral_update_event'
import {
  DepositProcessedEvent as AvalonDepositProcessedEvent,
  DepositQueuedEvent as AvalonDepositQueuedEvent,
} from '../contracts/avalon/typechain/AvalonLiquidityPool'
import {
  WithdrawProcessedEvent as AvalonWithdrawProcessedEvent,
  WithdrawQueuedEvent as AvalonWithdrawQueuedEvent,
} from '../contracts/avalon/typechain/AvalonLiquidityPool'
import { TradeEvent as AvalonTradeEvent } from '../contracts/avalon/typechain/AvalonOptionMarket'
import {
  PositionUpdatedEvent as AvalonPositionUpdatedEvent,
  TransferEvent as AvalonTransferEvent,
} from '../contracts/avalon/typechain/AvalonOptionToken'
import {
  DepositProcessedEvent as NewportDepositProcessedEvent,
  DepositQueuedEvent as NewportDepositQueuedEvent,
} from '../contracts/newport/typechain/NewportLiquidityPool'
import {
  WithdrawProcessedEvent as NewportWithdrawProcessedEvent,
  WithdrawQueuedEvent as NewportWithdrawQueuedEvent,
} from '../contracts/newport/typechain/NewportLiquidityPool'
import { TradeEvent as NewportTradeEvent } from '../contracts/newport/typechain/NewportOptionMarket'
import {
  PositionUpdatedEvent as NewportPositionUpdatedEvent,
  TransferEvent as NewportTransferEvent,
} from '../contracts/newport/typechain/NewportOptionToken'
import { SettleEventData } from '../settle_event'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'

export type PartialPositionUpdatedEvent = {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: (AvalonPositionUpdatedEvent | NewportPositionUpdatedEvent)['args']
}

export type PartialTradeEvent = {
  address: string // OptionMarket
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: (AvalonTradeEvent | NewportTradeEvent)['args']
}

export type PartialTransferEvent = {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: (AvalonTransferEvent | NewportTransferEvent)['args']
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

export type DepositProcessedEvent = NewportDepositProcessedEvent | AvalonDepositProcessedEvent

export type DepositQueuedEvent = NewportDepositQueuedEvent | AvalonDepositQueuedEvent

export type WithdrawProcessedEvent = NewportWithdrawProcessedEvent | AvalonWithdrawProcessedEvent

export type WithdrawQueuedEvent = NewportWithdrawQueuedEvent | AvalonWithdrawQueuedEvent
