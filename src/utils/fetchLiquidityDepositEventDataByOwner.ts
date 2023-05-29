import { gql } from '@apollo/client/core'
import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import {
  CIRCUIT_BREAKER_FRAGMENT,
  CircuitBreakerQueryResult,
  LIQUIDITY_DEPOSIT_FRAGMENT,
  LiquidityDepositQueryResult,
} from '../constants/queries'
import {
  LiquidityCircuitBreaker,
  LiquidityDelayReason,
  LiquidityDepositEvents,
  LiquidityDepositProcessedEvent,
  LiquidityDepositQueuedEvent,
} from '../liquidity_deposit'
import Lyra from '../lyra'
import { Market } from '../market'
import subgraphRequest from './subgraphRequest'

const lpUserLiquiditiesQuery = gql`
  query lpuserLiquidities($user: String!, $pool: String!) {
    lpuserLiquidities(where: { 
      user: $user,
      pool: $pool
    }) {
      ${LIQUIDITY_DEPOSIT_FRAGMENT}
    }
    circuitBreakers(first: 1, where: {
      pool: $pool
    }) {
      ${CIRCUIT_BREAKER_FRAGMENT}
    }
  }
`

type LiquidityDepositVariables = {
  user: string
  pool: string
}

export default async function fetchLiquidityDepositEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{ events: LiquidityDepositEvents[]; circuitBreaker: LiquidityCircuitBreaker | null }> {
  const { data } = await subgraphRequest<
    { lpuserLiquidities: LiquidityDepositQueryResult[]; circuitBreakers: CircuitBreakerQueryResult[] },
    LiquidityDepositVariables
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

  const depositQueuedEvents =
    userLiquidity.pendingDepositsAndWithdrawals.map(queuedDeposit => {
      return {
        depositor: owner,
        beneficiary: owner,
        queueId: parseInt(queuedDeposit.queueID, 10),
        amountDeposited: BigNumber.from(queuedDeposit.pendingAmount),
        totalQueuedDeposits: ZERO_BN,
        timestamp: queuedDeposit.timestamp,
        transactionHash: queuedDeposit.transactionHash,
      }
    }) ?? []

  const depositProcessedEvents =
    userLiquidity.depositsAndWithdrawals.map(processedDeposit => {
      return {
        caller: owner,
        beneficiary: owner,
        queueId: parseInt(processedDeposit.queueID, 10),
        amountDeposited: BigNumber.from(processedDeposit.quoteAmount),
        tokenPrice: BigNumber.from(processedDeposit.tokenPrice),
        tokensReceived: BigNumber.from(processedDeposit.tokenAmount),
        timestamp: processedDeposit.timestamp,
        transactionHash: processedDeposit.transactionHash,
      }
    }) ?? []

  const depositQueuedEventMap: Record<number, LiquidityDepositQueuedEvent> = depositQueuedEvents.reduce(
    (map, depositQueuedEvent) => ({
      ...map,
      [depositQueuedEvent.queueId]: depositQueuedEvent,
    }),
    {}
  )

  const depositProcessedEventMap: Record<number, LiquidityDepositProcessedEvent> = depositProcessedEvents.reduce(
    (map, depositProcessedEvent) => {
      if (depositProcessedEvent.queueId === 0) {
        return map
      } else {
        return {
          ...map,
          [depositProcessedEvent.queueId]: depositProcessedEvent,
        }
      }
    },
    {}
  )

  const instantDepositEvents: LiquidityDepositEvents[] = depositProcessedEvents.map(processed => ({
    processed,
    isProcessed: true,
    isInstant: true,
  }))

  const depositEvents: LiquidityDepositEvents[] = Object.entries(depositQueuedEventMap).map(
    ([depositQueueId, queued]) => {
      const processed = depositProcessedEventMap[parseInt(depositQueueId, 10)]
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
    events: instantDepositEvents.concat(depositEvents).sort((a, b) => {
      const bTimestamp = b.isProcessed ? b.processed.timestamp : b.queued.timestamp
      const aTimestamp = a.isProcessed ? a.processed.timestamp : a.queued.timestamp
      return bTimestamp - aTimestamp
    }),
    circuitBreaker,
  }
}
