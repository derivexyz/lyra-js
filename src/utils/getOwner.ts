import { ZERO_ADDRESS } from '../constants/bn'
import { TransferEventData } from '../transfer_event'

export default function getOwner(transfers: TransferEventData[], toBlockNumber: number): string {
  const latestTransfer = transfers
    // Filter out irrelevant blocks
    .filter(t => t.blockNumber <= toBlockNumber)
    // Sort most to least recent
    .sort((a, b) => b.blockNumber - a.blockNumber)
    // Ignore burn transfer
    .find(t => t.to !== ZERO_ADDRESS)
  if (!latestTransfer) {
    throw new Error('Must have at least one Transfer event')
  }
  return latestTransfer.to
}
