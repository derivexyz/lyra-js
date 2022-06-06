import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra, { MarketHistoryPeriodEnum } from '..'
import {
  MARKET_PENDING_LIQUIDITY_SNAPSHOT_FRAGMENT,
  MarketPendingLiquiditySnapshotQueryResult,
} from '../constants/queries'
import { Market, MarketPendingLiquidityHistory } from '../market'

const marketPendingLiquiditySnapshotsQuery = gql`
  query marketPendingLiquiditySnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    marketPendingLiquiditySnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: {
      market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${MARKET_PENDING_LIQUIDITY_SNAPSHOT_FRAGMENT}
    }
  }
`

type MarketPendingLiquiditySnapshotVariables = {
  market: string
  startTimestamp: number
  period: MarketHistoryPeriodEnum
}

export default async function fetchPendingLiquidityHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  period: MarketHistoryPeriodEnum
): Promise<MarketPendingLiquidityHistory[]> {
  const res = await lyra.subgraphClient.request<
    { marketPendingLiquiditySnapshots: MarketPendingLiquiditySnapshotQueryResult[] },
    MarketPendingLiquiditySnapshotVariables
  >(marketPendingLiquiditySnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })

  const pendingLiquidity: MarketPendingLiquidityHistory[] = res.marketPendingLiquiditySnapshots.map(
    (marketPendingLiquiditySnapshot: MarketPendingLiquiditySnapshotQueryResult) => {
      return {
        pendingDepositAmount: BigNumber.from(marketPendingLiquiditySnapshot.pendingDepositAmount),
        pendingWithdrawalAmount: BigNumber.from(marketPendingLiquiditySnapshot.pendingWithdrawalAmount),
        timestamp: marketPendingLiquiditySnapshot.timestamp,
      }
    }
  )

  return pendingLiquidity
}
