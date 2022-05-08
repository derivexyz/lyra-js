import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { OptionMarket } from '../contracts/typechain'
import { TradeEvent } from '../contracts/typechain/OptionMarket'
import filterNulls from './filterNulls'
import getLyraContractABI from './getLyraContractABI'

export type PartialTradeEvent = {
  address: string // OptionMarket
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: TradeEvent['args']
}

// Some transactions, e.g. liquidations, can have multiple Trade events
export default function parsePartialTradeEventsFromLogs(logs: Log[]): PartialTradeEvent[] {
  const optionMarket = new Contract(ZERO_ADDRESS, getLyraContractABI(LyraMarketContractId.OptionMarket)) as OptionMarket
  const events = filterNulls(
    logs.map(log => {
      try {
        const event = optionMarket.interface.parseLog(log)
        // Skip any Trade events with empty tradeResults (collateral adjustments)
        if (event.name === EventName.Trade && (event.args as TradeEvent['args']).tradeResults.length > 0) {
          return {
            address: log.address,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            args: event.args as TradeEvent['args'],
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
