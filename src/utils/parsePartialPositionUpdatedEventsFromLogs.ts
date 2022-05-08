import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { OptionToken } from '../contracts/typechain'
import { PositionUpdatedEvent } from '../contracts/typechain/OptionToken'
import filterNulls from './filterNulls'
import getLyraContractABI from './getLyraContractABI'

export type PartialPositionUpdatedEvent = {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: PositionUpdatedEvent['args']
}

export default function parsePartialPositionUpdatedEventsFromLogs(logs: Log[]): PartialPositionUpdatedEvent[] {
  const optionToken = new Contract(ZERO_ADDRESS, getLyraContractABI(LyraMarketContractId.OptionToken)) as OptionToken
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
