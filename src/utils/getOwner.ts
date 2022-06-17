import { ZERO_ADDRESS } from '../constants/bn'
import { PartialTransferEvent } from '../constants/events'
import sortEvents from './sortEvents'

export default function getOwner(transfers: PartialTransferEvent[], toBlockNumber: number): string {
  const filteredEvents = transfers
    // Filter out future blocks
    .filter(t => t.blockNumber <= toBlockNumber)

  // Least to most recent
  const sortedEvents = sortEvents(filteredEvents)

  if (sortedEvents.length === 0) {
    throw new Error('Missing transfer events')
  }

  const lastTransfer = sortedEvents[sortedEvents.length - 1]
  if (lastTransfer.args.to === ZERO_ADDRESS) {
    // Burn event, use first transfer "from" address with same transaction hash
    const firstLastTransfer = sortedEvents.find(t => t.transactionHash === lastTransfer.transactionHash) ?? lastTransfer
    return firstLastTransfer.args.from
  } else {
    // Mint or transfer event, use last transfer "to" address
    return lastTransfer.args.to
  }
}
