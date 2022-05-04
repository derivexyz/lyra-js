import { Log } from '@ethersproject/providers'
import { Contract } from 'ethers'

import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { OptionToken } from '../contracts/typechain'
import { TransferEvent } from '../contracts/typechain/OptionToken'
import filterNulls from './filterNulls'
import getLyraContractABI from './getLyraContractABI'

export type PartialTransferEvent = {
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: TransferEvent['args']
}

export default function parsePartialTransferEventFromLogs(logs: Log[]): PartialTransferEvent[] {
  const optionToken = new Contract(ZERO_ADDRESS, getLyraContractABI(LyraMarketContractId.OptionToken)) as OptionToken
  const events = filterNulls(
    logs.map(log => {
      try {
        const event = optionToken.interface.parseLog(log)
        if (event.name === EventName.Transfer) {
          return {
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
