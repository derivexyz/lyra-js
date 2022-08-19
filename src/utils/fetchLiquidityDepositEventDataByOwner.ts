import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import { DepositProcessedEvent, DepositQueuedEvent } from '../contracts/typechain/LiquidityPool'
import { Market } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export type DepositQueuedOrProcessedEvent = {
  queued?: DepositQueuedEvent
  processed?: DepositProcessedEvent
}

export default async function fetchLiquidityDepositEventDataByOwner(
  lyra: Lyra,
  market: Market,
  owner: string
): Promise<{
  events: DepositQueuedOrProcessedEvent[]
}> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.__marketData.marketAddresses,
    LyraMarketContractId.LiquidityPool
  )
  const [depositQueuedEvents, depositProcessedEvents] = await Promise.all([
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.DepositQueued(null, owner)),
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.DepositProcessed(null, owner)),
  ])

  const depositQueuedMap: Record<string, DepositQueuedEvent> = {}
  const depositProcessedMap: Record<string, DepositProcessedEvent> = {}
  const depositQueuedOrProcessedEvents: DepositQueuedOrProcessedEvent[] = []
  depositProcessedEvents.forEach((depositProcessedEvent: DepositProcessedEvent) => {
    if (depositProcessedEvent.args.depositQueueId.eq(ZERO_BN)) {
      depositQueuedOrProcessedEvents.push({
        processed: depositProcessedEvent,
      })
    }
  })

  depositQueuedEvents.forEach((depositQueuedEvent: DepositQueuedEvent) => {
    const id = String(depositQueuedEvent.args.depositQueueId)
    depositQueuedMap[id] = depositQueuedEvent
  })

  depositProcessedEvents.forEach((depositProcessedEvent: DepositProcessedEvent) => {
    const id = String(depositProcessedEvent.args.depositQueueId)
    depositProcessedMap[id] = depositProcessedEvent
  })

  depositQueuedEvents.forEach((depositQueuedEvent: DepositQueuedEvent) => {
    const id = String(depositQueuedEvent.args.depositQueueId)
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
