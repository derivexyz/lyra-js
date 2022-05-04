import { ZERO_ADDRESS } from '../constants/bn'
import { TransferEvent } from '../contracts/typechain/OptionToken'
import sortEvents from './sortEvents'

export default function getLatestTransferEvent(toBlockNumber: number, transferEvents: TransferEvent[]): TransferEvent {
  const latestTransferEvent = sortEvents(transferEvents)
    // Reverse chronological sort
    .reverse()
    // Latest transfer event that isn't a burn and is less than a given block number
    .find(e => e.args.to !== ZERO_ADDRESS && e.blockNumber <= toBlockNumber)
  if (!latestTransferEvent) {
    throw new Error('No transfer events for position')
  }
  return latestTransferEvent
}
