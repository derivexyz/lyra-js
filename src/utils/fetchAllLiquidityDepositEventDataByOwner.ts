import { gql } from '@apollo/client'
import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { LIQUIDITY_DEPOSIT_FRAGMENT, LiquidityDepositQueryResult } from '../constants/queries'
import { LiquidityDepositProcessedEvent, LiquidityDepositQueuedEvent } from '../liquidity_deposit'
import Lyra from '../lyra'
import { Market } from '../market'

const lpUserLiquiditiesQuery = gql`
  query lpuserLiquidities($user: String!, $pool: String!) {
    lpuserLiquidities(where: { 
      user: $user,
      pool: $pool
    }) {
      ${LIQUIDITY_DEPOSIT_FRAGMENT}
    }
  }
`

type LiquidityDepositVariables = {
  user: string
  pool: string
}

export default async function fetchAllLiquidityDepositEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  queued: LiquidityDepositQueuedEvent[]
  processed: LiquidityDepositProcessedEvent[]
}> {
  const { data } = await lyra.subgraphClient.query<
    { lpuserLiquidities: LiquidityDepositQueryResult[] },
    LiquidityDepositVariables
  >({
    query: lpUserLiquiditiesQuery,
    variables: {
      user: owner.toLowerCase(),
      pool: market.contractAddresses.liquidityPool.toLowerCase(),
    },
  })

  const depositQueuedEvents = data.lpuserLiquidities[0]?.pendingDepositsAndWithdrawals.map(queuedDeposit => {
    return {
      depositor: owner,
      beneficiary: owner,
      depositQueueId: BigNumber.from(queuedDeposit.queueID),
      amountDeposited: BigNumber.from(queuedDeposit.pendingAmount),
      totalQueuedDeposits: ZERO_BN,
      timestamp: BigNumber.from(queuedDeposit.timestamp),
      transactionHash: queuedDeposit.transactionHash,
    }
  })

  const depositProcessedEvents = data.lpuserLiquidities[0]?.depositsAndWithdrawals.map(processedDeposit => {
    return {
      caller: owner,
      beneficiary: owner,
      depositQueueId: ZERO_BN,
      amountDeposited: BigNumber.from(processedDeposit.quoteAmount),
      tokenPrice: BigNumber.from(processedDeposit.tokenPrice),
      tokensReceived: BigNumber.from(processedDeposit.tokenAmount),
      timestamp: BigNumber.from(processedDeposit.timestamp),
      transactionHash: processedDeposit.transactionHash,
    }
  })

  return {
    queued: depositQueuedEvents,
    processed: depositProcessedEvents,
  }
}
