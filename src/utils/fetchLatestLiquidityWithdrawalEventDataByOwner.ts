import Lyra from '..'
import { LyraMarketContractId } from '../constants/contracts'
import { LiquidityWithdrawalProcessedEvent, LiquidityWithdrawalQueuedEvent } from '../liquidity_withdrawal'
import { Market } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

const BLOCK_LIMIT = 100

export default async function fetchLatestLiquidityWithdrawalEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  queued: LiquidityWithdrawalQueuedEvent[]
  processed: LiquidityWithdrawalProcessedEvent[]
}> {
  const liquidityPoolContract = getLyraMarketContract(
    lyra,
    market.contractAddresses,
    lyra.version,
    LyraMarketContractId.LiquidityPool
  )

  // Approximately last 1 min of events
  const toBlockNumber = (await lyra.provider.getBlock('latest')).number
  const fromBlockNumber = toBlockNumber - BLOCK_LIMIT

  const [withdrawalQueuedEvents, withdrawalProcessedEvents] = await Promise.all([
    liquidityPoolContract.queryFilter(
      liquidityPoolContract.filters.WithdrawQueued(null, owner),
      fromBlockNumber,
      toBlockNumber
    ),
    liquidityPoolContract.queryFilter(
      liquidityPoolContract.filters.WithdrawProcessed(null, owner),
      fromBlockNumber,
      toBlockNumber
    ),
  ])

  const liquidityWithdrawalQueuedEvents: LiquidityWithdrawalQueuedEvent[] = withdrawalQueuedEvents.map(event => {
    return {
      withdrawer: event.args.withdrawer,
      beneficiary: event.args.beneficiary,
      withdrawalQueueId: event.args.withdrawalQueueId,
      amountWithdrawn: event.args.amountWithdrawn,
      totalQueuedWithdrawals: event.args.totalQueuedWithdrawals,
      timestamp: event.args.timestamp,
      transactionHash: event.transactionHash,
    }
  })

  const liquidityWithdrawalProcessedEvents: LiquidityWithdrawalProcessedEvent[] = withdrawalProcessedEvents.map(
    event => {
      return {
        caller: event.args.caller,
        beneficiary: event.args.beneficiary,
        withdrawalQueueId: event.args.withdrawalQueueId,
        amountWithdrawn: event.args.amountWithdrawn,
        tokenPrice: event.args.tokenPrice,
        quoteReceived: event.args.quoteReceived,
        totalQueuedWithdrawals: event.args.totalQueuedWithdrawals,
        timestamp: event.args.timestamp,
        transactionHash: event.transactionHash,
      }
    }
  )

  return {
    queued: liquidityWithdrawalQueuedEvents,
    processed: liquidityWithdrawalProcessedEvents,
  }
}
