import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import {
  DepositQueuedOrProcessedEvent,
  LiquidityDepositProcessedEvent,
  LiquidityDepositQueuedEvent,
} from '../liquidity_deposit'
import { Market } from '../market'
import fetchAllLiquidityDepositEventDataByOwner from './fetchAllLiquidityDepositEventDataByOwner'
import fetchLatestLiquidityDepositEventDataByOwner from './fetchLatestLiquidityDepositEventDataByOwner'
import getUniqueBy from './getUniqueBy'

export default async function fetchLiquidityDepositEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  events: DepositQueuedOrProcessedEvent[]
}> {
  const [latestLiquidityDeposit, allLiquidityDeposits] = await Promise.all([
    // Contract (realtime) data
    fetchLatestLiquidityDepositEventDataByOwner(lyra, owner, market),
    // Subgraph data
    fetchAllLiquidityDepositEventDataByOwner(lyra, owner, market),
  ])

  const uniqueQueuedDeposits = getUniqueBy(
    latestLiquidityDeposit.queued.concat(allLiquidityDeposits.queued),
    deposit => deposit?.timestamp
  )
  const uniqueProcessedDeposits = getUniqueBy(
    latestLiquidityDeposit.processed.concat(allLiquidityDeposits.processed),
    deposit => deposit?.timestamp
  )

  const depositQueuedMap: Record<string, LiquidityDepositQueuedEvent> = {}
  const depositProcessedMap: Record<string, LiquidityDepositProcessedEvent> = {}
  const depositQueuedOrProcessedEvents: DepositQueuedOrProcessedEvent[] = []
  uniqueProcessedDeposits.forEach((depositProcessedEvent: LiquidityDepositProcessedEvent) => {
    if (depositProcessedEvent?.depositQueueId.eq(ZERO_BN)) {
      depositQueuedOrProcessedEvents.push({
        processed: depositProcessedEvent,
      })
    }
  })

  uniqueQueuedDeposits.forEach((depositQueuedEvent: LiquidityDepositQueuedEvent) => {
    const id = String(depositQueuedEvent?.depositQueueId)
    depositQueuedMap[id] = depositQueuedEvent
  })

  uniqueProcessedDeposits.forEach((depositProcessedEvent: LiquidityDepositProcessedEvent) => {
    const id = String(depositProcessedEvent?.depositQueueId)
    depositProcessedMap[id] = depositProcessedEvent
  })

  uniqueQueuedDeposits.forEach((depositQueuedEvent: LiquidityDepositQueuedEvent) => {
    const id = String(depositQueuedEvent?.depositQueueId)
    if (depositQueuedMap[id] && depositProcessedMap[id]) {
      depositQueuedOrProcessedEvents.push({
        queued: depositQueuedMap[id],
        processed: depositProcessedMap[id],
      })
    } else if (depositQueuedMap[id] && !depositProcessedMap[id]) {
      depositQueuedOrProcessedEvents.push({
        queued: depositQueuedMap[id],
      })
    }
  })
  return {
    events: depositQueuedOrProcessedEvents,
  }
}
