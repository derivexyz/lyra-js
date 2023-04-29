import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import Lyra from '..'
import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { PartialTradeEvent } from '../constants/events'
import filterNulls from './filterNulls'
import { getMarketContractABI } from './getLyraMarketContract'

// Some transactions, e.g. liquidations, can have multiple Trade events
export default function parsePartialTradeEventsFromLogs(lyra: Lyra, logs: Log[]): PartialTradeEvent[] {
  const optionMarket = new Contract(
    ZERO_ADDRESS,
    // EventName.Trade ABI events are not the same
    getMarketContractABI(lyra.version, LyraMarketContractId.OptionMarket)
  )
  const events = filterNulls(
    logs.map(log => {
      try {
        const event = optionMarket.interface.parseLog(log)
        // Skip any Trade events with empty tradeResults (collateral adjustments)
        if (event.name === EventName.Trade && (event.args as PartialTradeEvent['args']).tradeResults.length > 0) {
          return {
            address: log.address,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            args: event.args as PartialTradeEvent['args'],
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
