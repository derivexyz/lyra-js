import { gql } from '@apollo/client/core'
import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import {
  CIRCUIT_BREAKER_FRAGMENT,
  CircuitBreakerQueryResult,
  LIQUIDITY_WITHDRAWAL_FRAGMENT,
  LiquidityWithdrawalQueryResult,
} from '../constants/queries'
import { LiquidityCircuitBreaker, LiquidityDelayReason } from '../liquidity_deposit'
import {
  LiquidityWithdrawalEvents,
  LiquidityWithdrawalProcessedEvent,
  LiquidityWithdrawalQueuedEvent,
} from '../liquidity_withdrawal'
import Lyra from '../lyra'
import { Market } from '../market'
import subgraphRequest from './subgraphRequest'

const lpUserLiquiditiesQuery = gql`
  query lpuserLiquidities($user: String!, $pool: String!) {
    lpuserLiquidities(where: { 
      user: $user,
      pool: $pool
    }) {
      ${LIQUIDITY_WITHDRAWAL_FRAGMENT}
    }
    circuitBreakers(first: 1, where: {
      pool: $pool
    }) {
      ${CIRCUIT_BREAKER_FRAGMENT}
    }
  }
`

type LiquidityWithdrawalVariables = {
  user: string
  pool: string
}

export default async function fetchLiquidityWithdrawalEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  events: LiquidityWithdrawalEvents[]
  circuitBreaker: LiquidityCircuitBreaker | null
}> {
  const { data } = await subgraphRequest<
    { lpuserLiquidities: LiquidityWithdrawalQueryResult[]; circuitBreakers: CircuitBreakerQueryResult[] },
    LiquidityWithdrawalVariables
  >(lyra.subgraphClient, {
    query: lpUserLiquiditiesQuery,
    variables: {
      user: owner.toLowerCase(),
      pool: market.contractAddresses.liquidityPool.toLowerCase(),
    },
  })

  const userLiquidity = data?.lpuserLiquidities[0]
  const circuitBreakerData = data?.circuitBreakers[0]

  const circuitBreaker: LiquidityCircuitBreaker | null = circuitBreakerData
    ? {
        timestamp: circuitBreakerData.cbTimestamp,
        reason:
          circuitBreakerData.ivVarianceCrossed || circuitBreakerData.skewVarianceCrossed
            ? LiquidityDelayReason.Volatility
            : circuitBreakerData.liquidityVarianceCrossed
            ? LiquidityDelayReason.Liquidity
            : LiquidityDelayReason.Keeper,
      }
    : null

  if (!userLiquidity) {
    return { circuitBreaker, events: [] }
  }

  const withdrawalQueuedEvents =
    userLiquidity.pendingDepositsAndWithdrawals.map(queuedWithdrawal => {
      return {
        withdrawer: owner,
        beneficiary: owner,
        queueId: parseInt(queuedWithdrawal.queueID, 10),
        amountWithdrawn: BigNumber.from(queuedWithdrawal.pendingAmount),
        totalQueuedWithdrawals: ZERO_BN,
        timestamp: queuedWithdrawal.timestamp,
        transactionHash: queuedWithdrawal.transactionHash,
      }
    }) ?? []

  const withdrawalProcessedEvents =
    userLiquidity.depositsAndWithdrawals.map(processedWithdrawal => {
      return {
        caller: owner,
        beneficiary: owner,
        queueId: parseInt(processedWithdrawal.queueID, 10),
        amountWithdrawn: BigNumber.from(processedWithdrawal.quoteAmount),
        tokenPrice: BigNumber.from(processedWithdrawal.tokenPrice),
        quoteReceived: BigNumber.from(processedWithdrawal.tokenAmount),
        totalQueuedWithdrawals: ZERO_BN,
        timestamp: processedWithdrawal.timestamp,
        transactionHash: processedWithdrawal.transactionHash,
      }
    }) ?? []

  const withdrawalQueuedEventMap: Record<number, LiquidityWithdrawalQueuedEvent> = withdrawalQueuedEvents.reduce(
    (map, withdrawalQueuedEvent) => ({
      ...map,
      [withdrawalQueuedEvent.queueId]: withdrawalQueuedEvent,
    }),
    {}
  )

  const withdrawalProcessedEventMap: Record<number, LiquidityWithdrawalProcessedEvent> =
    withdrawalProcessedEvents.reduce((map, withdrawalProcessedEvent) => {
      if (withdrawalProcessedEvent.queueId === 0) {
        return map
      } else {
        return {
          ...map,
          [withdrawalProcessedEvent.queueId]: withdrawalProcessedEvent,
        }
      }
    }, {})

  const instantDepositEvents: LiquidityWithdrawalEvents[] = withdrawalProcessedEvents.map(processed => ({
    processed,
    isProcessed: true,
    isInstant: true,
  }))

  const withdrawalEvents: LiquidityWithdrawalEvents[] = Object.entries(withdrawalQueuedEventMap).map(
    ([withdrawalQueueId, queued]) => {
      const processed = withdrawalProcessedEventMap[parseInt(withdrawalQueueId, 10)]
      if (processed) {
        return {
          queued,
          processed,
          isProcessed: true,
          isInstant: false,
        }
      } else {
        return {
          queued,
          isProcessed: false,
          isInstant: false,
        }
      }
    }
  )

  return {
    events: instantDepositEvents.concat(withdrawalEvents).sort((a, b) => {
      const bTimestamp = b.isProcessed ? b.processed.timestamp : b.queued.timestamp
      const aTimestamp = a.isProcessed ? a.processed.timestamp : a.queued.timestamp
      return bTimestamp - aTimestamp
    }),
    circuitBreaker,
  }
}
