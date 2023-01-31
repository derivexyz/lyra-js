import { gql } from '@apollo/client'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import {
  MARKET_GREEKS_SNAPSHOT_FRAGMENT,
  MarketGreeksSnapshotQueryResult,
  SNAPSHOT_RESULT_LIMIT,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketNetGreeksSnapshot } from '../market'
import fetchSnapshots from './fetchSnapshots'

const marketGreeksSnapshotsQuery = gql`
  query marketGreeksSnapshots(
    $market: String!, $min: Int!, $max: Int! $period: Int!,
  ) {
    marketGreeksSnapshots(first: ${SNAPSHOT_RESULT_LIMIT}, orderBy: timestamp, orderDirection: asc, where: { market: $market, 
      timestamp_gte: $min,
      timestamp_lte: $max,
      period_gte: $period
    }) {
      ${MARKET_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

const EMPTY: Omit<MarketNetGreeksSnapshot, 'timestamp'> = {
  poolNetDelta: ZERO_BN,
  hedgerNetDelta: ZERO_BN,
  netDelta: ZERO_BN,
  netStdVega: ZERO_BN,
}

export default async function fetchNetGreeksHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketNetGreeksSnapshot[]> {
  const data = await fetchSnapshots<MarketGreeksSnapshotQueryResult, { market: string }>(
    lyra,
    marketGreeksSnapshotsQuery,
    {
      market: market.address.toLowerCase(),
    },
    {
      ...options,
      endTimestamp: options?.endTimestamp ?? market.block.timestamp,
    }
  )

  if (data.length === 0) {
    // Always return at least 1 snapshot
    return [{ ...EMPTY, timestamp: market.block.timestamp }]
  }

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
