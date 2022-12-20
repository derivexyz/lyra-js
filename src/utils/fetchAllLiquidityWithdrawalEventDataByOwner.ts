import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { ZERO_BN } from '../constants/bn'
import { LIQUIDITY_WITHDRAWAL_FRAGMENT, LiquidityWithdrawalQueryResult } from '../constants/queries'
import { LiquidityWithdrawalProcessedEvent, LiquidityWithdrawalQueuedEvent } from '../liquidity_withdrawal'
import Lyra from '../lyra'
import { Market } from '../market'

const lpUserLiquiditiesQuery = gql`
  query lpuserLiquidities($user: String!, $pool: String!) {
    lpuserLiquidities(where: { 
      user: $user,
      pool: $pool
    }) {
      ${LIQUIDITY_WITHDRAWAL_FRAGMENT}
    }
  }
`

type LiquidityWithdrawalVariables = {
  user: string
  pool: string
}

export default async function fetchAllLiquidityWithdrawalEventDataByOwner(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<{
  queued: LiquidityWithdrawalQueuedEvent[]
  processed: LiquidityWithdrawalProcessedEvent[]
}> {
  const res = await lyra.subgraphClient.request<
    { lpuserLiquidities: LiquidityWithdrawalQueryResult[] },
    LiquidityWithdrawalVariables
  >(lpUserLiquiditiesQuery, {
    user: owner.toLowerCase(),
    pool: market.contractAddresses.liquidityPool.toLowerCase(),
  })

  const withdrawalQueuedEvents = res.lpuserLiquidities[0]?.pendingDepositsAndWithdrawals.map(queuedWithdrawal => {
    return {
      withdrawer: owner,
      beneficiary: owner,
      withdrawalQueueId: BigNumber.from(queuedWithdrawal.queueID),
      amountWithdrawn: BigNumber.from(queuedWithdrawal.pendingAmount),
      totalQueuedWithdrawals: ZERO_BN,
      timestamp: BigNumber.from(queuedWithdrawal.timestamp),
      transactionHash: queuedWithdrawal.transactionHash,
    }
  })

  const withdrawalProcessedEvents = res.lpuserLiquidities[0]?.depositsAndWithdrawals.map(processedWithdrawal => {
    return {
      caller: owner,
      beneficiary: owner,
      withdrawalQueueId: ZERO_BN,
      amountWithdrawn: BigNumber.from(processedWithdrawal.quoteAmount),
      tokenPrice: BigNumber.from(processedWithdrawal.tokenPrice),
      quoteReceived: BigNumber.from(processedWithdrawal.tokenAmount),
      totalQueuedWithdrawals: ZERO_BN,
      timestamp: BigNumber.from(processedWithdrawal.timestamp),
      transactionHash: processedWithdrawal.transactionHash,
    }
  })

  return {
    queued: withdrawalQueuedEvents,
    processed: withdrawalProcessedEvents,
  }
}
