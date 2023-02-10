import { gql } from '@apollo/client/core'
import { BigNumber } from 'ethers'

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
  const { data } = await lyra.subgraphClient.query<
    { lpuserLiquidities: LiquidityWithdrawalQueryResult[] },
    LiquidityWithdrawalVariables
  >({
    query: lpUserLiquiditiesQuery,
    variables: {
      user: owner.toLowerCase(),
      pool: market.contractAddresses.liquidityPool.toLowerCase(),
    },
  })

  const withdrawalQueuedEvents = data.lpuserLiquidities[0]?.pendingDepositsAndWithdrawals.map(queuedWithdrawal => {
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

  const withdrawalProcessedEvents = data.lpuserLiquidities[0]?.depositsAndWithdrawals.map(processedWithdrawal => {
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
