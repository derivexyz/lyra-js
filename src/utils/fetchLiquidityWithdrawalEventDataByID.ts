import Lyra from '..'
import { LyraMarketContractId } from '../constants/contracts'
import { WithdrawProcessedEvent, WithdrawQueuedEvent } from '../contracts/typechain/LiquidityPool'
import { Market } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default async function fetchLiquidityWithdrawalEventDataByID(
  lyra: Lyra,
  market: Market,
  id: string
): Promise<{
  queued?: WithdrawQueuedEvent
  processed?: WithdrawProcessedEvent
}> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.__marketData.marketAddresses,
    LyraMarketContractId.LiquidityPool
  )
  const [withdrawalQueuedEvents, withdrawalProcessedEvents] = await Promise.all([
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.WithdrawQueued(null, null, id)),
    liquidityPoolContract.queryFilter(liquidityPoolContract.filters.WithdrawProcessed(null, null, id)),
  ])

  const queued = withdrawalQueuedEvents[0]
  const processed = withdrawalProcessedEvents[0]

  return {
    queued,
    processed,
  }
}
