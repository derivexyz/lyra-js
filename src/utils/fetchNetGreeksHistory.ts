import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketNetGreeks } from '../market'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const marketGreeksSnapshotsQuery = gql`
  query marketGreeksSnapshots(
    $market: String!, $startTimestamp: Int!, $endTimestamp: Int! $period: Int!
  ) {
    marketGreeksSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { market: $market, 
      timestamp_gte: $startTimestamp, 
      timestamp_lte: $endTimestamp,
      period_gte: $period
    }) {
      ${MARKET_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

type MarketGreeksSnapshotVariables = {
  market: string
}

export default async function fetchNetGreeksHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketNetGreeks[]> {
  const startTimestamp = options?.startTimestamp ?? 0
  const endTimestamp = options?.endTimestamp ?? market.block.timestamp
  const data = await fetchSnapshots<MarketGreeksSnapshotQueryResult, MarketGreeksSnapshotVariables>(
    lyra,
    marketGreeksSnapshotsQuery,
    'marketGreeksSnapshots',
    {
      market: market.address.toLowerCase(),
      startTimestamp,
      endTimestamp,
      period: getSnapshotPeriod(startTimestamp, endTimestamp),
    }
  )
  return data.map(marketGreeksSnapshot => {
    const poolNetDelta = BigNumber.from(marketGreeksSnapshot.poolNetDelta)
    const hedgerNetDelta = BigNumber.from(marketGreeksSnapshot.hedgerNetDelta)
    const netDelta = BigNumber.from(marketGreeksSnapshot.netDelta)
    const netStdVega = BigNumber.from(marketGreeksSnapshot.netStdVega)
    return {
      poolNetDelta,
      hedgerNetDelta,
      netDelta,
      netStdVega,
      timestamp: marketGreeksSnapshot.timestamp,
    }
  })
}
