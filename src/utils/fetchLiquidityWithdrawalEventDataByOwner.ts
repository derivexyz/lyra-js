import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import { WithdrawProcessedEvent, WithdrawQueuedEvent } from '../contracts/typechain/LiquidityPool'
import { Market } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export type WithdrawalQueuedOrProcessedEvent = {
  queued?: WithdrawQueuedEvent
  processed?: WithdrawProcessedEvent
}

export default async function fetchLiquidityWithdrawalEventDataByOwner(
  lyra: Lyra,
  market: Market,
  owner: string
): Promise<{
  events: WithdrawalQueuedOrProcessedEvent[]
}> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.__marketData.marketAddresses,
    LyraMarketContractId.LiquidityPool
  )
  const [withdrawalQueuedEvents, withdrawalProcessedEvents] = await Promise.all([
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.WithdrawQueued(owner)),
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.WithdrawProcessed(null, owner)),
  ])

  const withdrawalQueuedMap: Record<string, WithdrawQueuedEvent> = {}
  const withdrawalProcessedMap: Record<string, WithdrawProcessedEvent> = {}
  const withdrawalQueuedOrProcessedEvents: WithdrawalQueuedOrProcessedEvent[] = []
  withdrawalProcessedEvents.forEach((withdrawalProcessedEvent: WithdrawProcessedEvent) => {
    if (withdrawalProcessedEvent.args.withdrawalQueueId == ZERO_BN) {
      withdrawalQueuedOrProcessedEvents.push({
        processed: withdrawalProcessedEvent,
      })
    }
  })

  withdrawalQueuedEvents.forEach((withdrawalQueuedEvent: WithdrawQueuedEvent) => {
    const id = String(withdrawalQueuedEvent.args.withdrawalQueueId)
    withdrawalQueuedMap[id] = withdrawalQueuedEvent
  })

  withdrawalProcessedEvents.forEach((withdrawalProcessedEvent: WithdrawProcessedEvent) => {
    const id = String(withdrawalProcessedEvent.args.withdrawalQueueId)
    withdrawalProcessedMap[id] = withdrawalProcessedEvent
  })

  withdrawalQueuedEvents.forEach((withdrawalQueuedEvent: WithdrawQueuedEvent) => {
    const id = String(withdrawalQueuedEvent.args.withdrawalQueueId)
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
