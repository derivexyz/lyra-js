import { PartialTransferEvent } from '../constants/events'
import { TransferEventData } from '../transfer_event'
import sortEvents from './sortEvents'

export default function getTransferDataFromEvents(transferEvents: PartialTransferEvent[]): TransferEventData[] {
  const sortedTransferEvents = sortEvents(transferEvents) // Ascending order (least to most recent)
  const transfersByHash: Record<string, PartialTransferEvent[]> = {}
  sortedTransferEvents.forEach(transferEvent => {
    if (!transfersByHash[transferEvent.transactionHash]) {
      transfersByHash[transferEvent.transactionHash] = []
    }
    transfersByHash[transferEvent.transactionHash].push(transferEvent)
  })
  Object.entries(transfersByHash).forEach(([transactionHash, transferEvents]) => {
    const firstTransfer = transferEvents[0]
    const lastTransfer = transferEvents[transferEvents.length - 1]
    if (firstTransfer.args.from === lastTransfer.args.to) {
      // Remove any transfer groups that are mints / burns
      // Also remove any transfer groups that are transferred back to the original owner in the same tx
      // This is typically a transfer to an internal contract that returns the position to a user
      delete transfersByHash[transactionHash]
    }
  })

  return Object.entries(transfersByHash).map(([transactionHash, transferEvents]) => {
    const firstTransfer = transferEvents[0]
    const lastTransfer = transferEvents[transferEvents.length - 1]
    const blockNumber = lastTransfer.blockNumber
    return {
      from: firstTransfer.args.from,
      to: lastTransfer.args.to,
      transactionHash,
      blockNumber,
    }
  })
}
