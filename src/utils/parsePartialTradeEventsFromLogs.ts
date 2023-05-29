import { Contract } from '@ethersproject/contracts'
import { Log } from '@ethersproject/providers'

import { Version } from '..'
import { ZERO_ADDRESS } from '../constants/bn'
import { EventName, LyraMarketContractId } from '../constants/contracts'
import { PartialTradeEvent } from '../constants/events'
import { Network } from '../constants/network'
import filterNulls from './filterNulls'
import { getMarketContractABI } from './getLyraMarketContract'

// Some transactions, e.g. liquidations, can have multiple Trade events
export default function parsePartialTradeEventsFromLogs(logs: Log[], network: Network): PartialTradeEvent[] {
  const optionMarket = new Contract(
    ZERO_ADDRESS,
    // Hard-coded Version as these ABI events are functionally the same
    getMarketContractABI(Version.Newport, LyraMarketContractId.OptionMarket, network)
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
