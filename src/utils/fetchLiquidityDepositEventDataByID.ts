import Lyra from '..'
import { LyraMarketContractId } from '../constants/contracts'
import { DepositProcessedEvent, DepositQueuedEvent } from '../contracts/typechain/LiquidityPool'
import { Market } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default async function fetchLiquidityDepositEventDataByID(
  lyra: Lyra,
  market: Market,
  id: string
): Promise<{
  queued?: DepositQueuedEvent
  processed?: DepositProcessedEvent
}> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.__marketData.marketAddresses,
    LyraMarketContractId.LiquidityPool
  )
  const [depositQueuedEvents, depositProcessedEvents] = await Promise.all([
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.DepositQueued(null, null, id)),
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.DepositProcessed(null, null, id)),
  ])

  const queued = depositQueuedEvents[0]
  const processed = depositProcessedEvents[0]

  return {
    queued,
    processed,
  }
}
