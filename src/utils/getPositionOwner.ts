import { ZERO_ADDRESS } from '../constants/bn'
import { PartialTransferEvent } from '../constants/events'

export default function getPositionOwner(transfers: PartialTransferEvent[], toBlockNumber: number): string {
  const events = transfers
    // Filter out future blocks
    .filter(t => t.blockNumber <= toBlockNumber)

  if (events.length === 0) {
    throw new Error('Missing transfer events')
  }

  const lastTransfer = events[events.length - 1]
  if (lastTransfer.args.to === ZERO_ADDRESS) {
    // Burn event, use first transfer "from" address with same transaction hash
    const firstLastTransfer = events.find(t => t.transactionHash === lastTransfer.transactionHash) ?? lastTransfer
    return firstLastTransfer.args.from
  } else {
    // Mint or transfer event, use last transfer "to" address
    return lastTransfer.args.to
  }
}
