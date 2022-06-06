import { gql } from 'graphql-request'

import Lyra, { MarketHistoryPeriodEnum } from '..'
import { POOL_HEDGER_EXPOSURE_SNAPSHOT_FRAGMENT, PoolHedgerExposureSnapshotQueryResult } from '../constants/queries'
import { Market } from '../market'

const poolHedgerExposureSnapshotsQuery = gql`
  query poolHedgerExposureSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    poolHedgerExposureSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: {
      market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${POOL_HEDGER_EXPOSURE_SNAPSHOT_FRAGMENT}
    }
  }
`

type PoolHedgerExposureSnapshotVariables = {
  market: string
  startTimestamp: number
  period: MarketHistoryPeriodEnum
}

export default async function fetchPoolHedgerHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  period: MarketHistoryPeriodEnum
): Promise<PoolHedgerExposureSnapshotQueryResult[]> {
  const res = await lyra.subgraphClient.request<
    {
      poolHedgerExposureSnapshots: PoolHedgerExposureSnapshotQueryResult[]
    },
    PoolHedgerExposureSnapshotVariables
  >(poolHedgerExposureSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })
  return res.poolHedgerExposureSnapshots
}
