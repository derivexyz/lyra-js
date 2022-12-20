import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import {
  LiquidityWithdrawalProcessedEvent,
  LiquidityWithdrawalQueuedEvent,
  WithdrawalQueuedOrProcessedEvent,
} from '../liquidity_withdrawal'
import { Market } from '../market'
import fetchAllLiquidityWithdrawalEventDataByOwner from './fetchAllLiquidityWithdrawalEventDataByOwner'
import fetchLatestLiquidityWithdrawalEventDataByOwner from './fetchLatestLiquidityWithdrawalEventDataByOwner'
import getUniqueBy from './getUniqueBy'

export default async function fetchLiquidityWithdrawalEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  events: WithdrawalQueuedOrProcessedEvent[]
}> {
  const [latestLiquidityWithdrawal, allLiquidityWithdrawals] = await Promise.all([
    // Contract (realtime) data
    fetchLatestLiquidityWithdrawalEventDataByOwner(lyra, owner, market),
    // Subgraph data
    fetchAllLiquidityWithdrawalEventDataByOwner(lyra, owner, market),
  ])

  const uniqueQueuedWithdrawals = getUniqueBy(
    latestLiquidityWithdrawal.queued.concat(allLiquidityWithdrawals.queued),
    withdrawal => withdrawal?.timestamp
  )
  const uniqueProcessedWithdrawals = getUniqueBy(
    latestLiquidityWithdrawal.processed.concat(allLiquidityWithdrawals.processed),
    withdrawal => withdrawal?.timestamp
  )

  const withdrawalQueuedMap: Record<string, LiquidityWithdrawalQueuedEvent> = {}
  const withdrawalProcessedMap: Record<string, LiquidityWithdrawalProcessedEvent> = {}
  const withdrawalQueuedOrProcessedEvents: WithdrawalQueuedOrProcessedEvent[] = []

  uniqueProcessedWithdrawals.forEach((withdrawalProcessedEvent: LiquidityWithdrawalProcessedEvent) => {
    if (withdrawalProcessedEvent?.withdrawalQueueId == ZERO_BN) {
      withdrawalQueuedOrProcessedEvents.push({
        processed: withdrawalProcessedEvent,
      })
    }
  })

  uniqueQueuedWithdrawals.forEach((withdrawalQueuedEvent: LiquidityWithdrawalQueuedEvent) => {
    const id = String(withdrawalQueuedEvent?.withdrawalQueueId)
    withdrawalQueuedMap[id] = withdrawalQueuedEvent
  })

  uniqueProcessedWithdrawals.forEach((withdrawalProcessedEvent: LiquidityWithdrawalProcessedEvent) => {
    const id = String(withdrawalProcessedEvent?.withdrawalQueueId)
    withdrawalProcessedMap[id] = withdrawalProcessedEvent
  })

  uniqueQueuedWithdrawals.forEach((withdrawalQueuedEvent: LiquidityWithdrawalQueuedEvent) => {
    const id = String(withdrawalQueuedEvent?.withdrawalQueueId)
    if (withdrawalQueuedMap[id] && withdrawalProcessedMap[id]) {
      withdrawalQueuedOrProcessedEvents.push({
        queued: withdrawalQueuedMap[id],
        processed: withdrawalProcessedMap[id],
      })
    } else if (withdrawalQueuedMap[id] && !withdrawalProcessedMap[id]) {
      withdrawalQueuedOrProcessedEvents.push({
        queued: withdrawalQueuedMap[id],
      })
    }
  })

  return {
    events: withdrawalQueuedOrProcessedEvents,
  }
}
