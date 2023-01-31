import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'

import Lyra, {
  LyraMarketContractId,
  TradeEvent,
  TradeEventListener,
  TradeEventListenerCallback,
  TradeEventListenerOptions,
} from '..'
import { ZERO_ADDRESS } from '../constants/bn'
import { PartialTradeEvent } from '../constants/events'
import fetchMarketAddresses from './fetchMarketAddresses'
import { getMarketContractABI } from './getLyraMarketContract'

const DEFAULT_POLL_INTERVAL = 10 * 1000

export default function fetchTradeListener(
  lyra: Lyra,
  callback: TradeEventListenerCallback,
  options?: TradeEventListenerOptions
): TradeEventListener {
  const ms = options?.pollInterval ?? DEFAULT_POLL_INTERVAL
  const startBlockTag = options?.startBlockNumber ?? 'latest'

  let timeout: NodeJS.Timeout | null

  const optionMarket = new Contract(ZERO_ADDRESS, getMarketContractABI(lyra.version, LyraMarketContractId.OptionMarket))

  Promise.all([fetchMarketAddresses(lyra), lyra.provider.getBlock(startBlockTag)]).then(async ([addresses, block]) => {
    console.debug(`Polling from block ${block.number} every ${ms}ms`)
    let prevBlock = block

    const poll = async () => {
      const latestBlock = await lyra.provider.getBlock('latest')
      const fromBlockNumber = prevBlock.number + 1
      const toBlockNumber = latestBlock.number
      if (fromBlockNumber >= toBlockNumber) {
        // Skip if no new blocks
        setTimeout(poll, ms)
        return
      }
      console.debug(
        `Querying block range: ${fromBlockNumber} to ${toBlockNumber} (${toBlockNumber - fromBlockNumber} blocks)`
      )
      // Fetch new trades
      const trades: PartialTradeEvent[] = await lyra.provider.send('eth_getLogs', [
        {
          address: addresses.map(a => a.optionMarket),
          fromBlock: BigNumber.from(fromBlockNumber).toHexString(),
          toBlock: BigNumber.from(toBlockNumber).toHexString(),
          topics: [[(optionMarket.filters.Trade().topics ?? [])[0]]],
        },
      ])
      if (trades.length > 0) {
        console.debug(`Found ${trades.length} new trades`)
      }
      // Parse trade events
      await Promise.all(
        trades.map(async trade => {
          const tradeEvents = await TradeEvent.getByHash(lyra, trade.transactionHash)
          tradeEvents.map(tradeEvent => callback(tradeEvent))
        })
      )

      // Poll
      prevBlock = latestBlock
      setTimeout(poll, ms)
    }

    timeout = setTimeout(poll, ms)
  })

  return {
    off: () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    },
  }
}
