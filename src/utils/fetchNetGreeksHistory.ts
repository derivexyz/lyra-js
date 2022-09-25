import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketNetGreeks } from '../market'
import fetchSnapshots from './fetchSnapshots'

const marketGreeksSnapshotsQuery = gql`
  query marketGreeksSnapshots(
    $market: String!, $min: Int!, $max: Int! $period: Int!
  ) {
    marketGreeksSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { market: $market, 
      timestamp_gte: $min, 
      timestamp_lte: $max,
      period_gte: $period
    }) {
      ${MARKET_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchNetGreeksHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketNetGreeks[]> {
  const data = await fetchSnapshots<MarketGreeksSnapshotQueryResult, { market: string }>(
    lyra,
    marketGreeksSnapshotsQuery,
    {
      market: market.address.toLowerCase(),
    },
    options
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
