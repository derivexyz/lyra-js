import { LiquidityDelayReason, Market } from '..'
import { LyraMarketContractId, VAULTS_UTILIZATION_THRESHOLD } from '../constants/contracts'
import Lyra from '../lyra'
import { DepositQueuedOrProcessedEvent } from './fetchLiquidityDepositEventDataByOwner'
import { WithdrawalQueuedOrProcessedEvent } from './fetchLiquidityWithdrawalEventDataByOwner'
import getLyraMarketContract from './getLyraMarketContract'

export default async function fetchLiquidityDelayReason(
  lyra: Lyra,
  market: Market,
  event: WithdrawalQueuedOrProcessedEvent | DepositQueuedOrProcessedEvent
): Promise<LiquidityDelayReason | LiquidityDelayReason | null> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.contractAddresses,
    LyraMarketContractId.LiquidityPool
  )
  const currentTimestamp = market.block.timestamp
  const cbTimestamp = await liquidityPoolContract.CBTimestamp()
  if (cbTimestamp.gt(currentTimestamp)) {
    if (market.liquidity.utilization > VAULTS_UTILIZATION_THRESHOLD) {
      return LiquidityDelayReason.Liquidity
    } else {
      return LiquidityDelayReason.Volatility
    }
  } else {
    const duration = market.withdrawalDelay
    const startTimestamp = event.queued?.args.timestamp.toNumber() ?? 0
    const progressDuration = Math.min(Math.max(currentTimestamp - startTimestamp, 0), duration)
    const timeToEntryExit = duration - progressDuration
    if (timeToEntryExit === 0) {
      return LiquidityDelayReason.Keeper
    }
  }
  return null
}
