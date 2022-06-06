import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { PartialTransferEvent } from '../constants/events'
import { OptionToken } from '../contracts/typechain'
import { TransferEvent } from '../contracts/typechain/OptionToken'
import filterNulls from './filterNulls'
import getLyraContractABI from './getLyraContractABI'

export default function parsePartialTransferEventsFromLogs(logs: Log[]): PartialTransferEvent[] {
  const optionToken = new Contract(ZERO_ADDRESS, getLyraContractABI(LyraMarketContractId.OptionToken)) as OptionToken
  const events = filterNulls(
    logs.map(log => {
      try {
        const event = optionToken.interface.parseLog(log)
        if (event.name === EventName.Transfer) {
          return {
            address: log.address,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            args: event.args as TransferEvent['args'],
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
