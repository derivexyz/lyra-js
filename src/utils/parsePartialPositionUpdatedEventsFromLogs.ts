import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { PartialPositionUpdatedEvent } from '../constants/events'
import { OptionToken } from '../contracts/newport/typechain'
import { PositionUpdatedEvent } from '../contracts/newport/typechain/OptionToken'
import { Version } from '../lyra'
import filterNulls from './filterNulls'
import getLyraContractABI from './getLyraContractABI'

export default function parsePartialPositionUpdatedEventsFromLogs(logs: Log[]): PartialPositionUpdatedEvent[] {
  const optionToken = new Contract(
    ZERO_ADDRESS,
    // Hard-coded version as these ABI events are functionally the same
    getLyraContractABI(Version.Newport, LyraMarketContractId.OptionToken)
  ) as OptionToken
  const events = filterNulls(
    logs.map(log => {
      try {
        const event = optionToken.interface.parseLog(log)
        if (event.name === EventName.PositionUpdated) {
          return {
            address: log.address,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            args: event.args as PositionUpdatedEvent['args'],
          }
        }
        return null
      } catch (e) {
        return null
      }
    })
  )
  return events
}
