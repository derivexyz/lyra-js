import { gql } from '@apollo/client/core'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult, SnapshotPeriod } from '../constants/queries'
import { Market, MarketNetGreeksSnapshot } from '../market'
import subgraphRequest from './subgraphRequest'

const marketGreeksSnapshotsQuery = gql`
  query marketGreeksSnapshots($market: String!) {
    marketGreeksSnapshots(first: 1, orderBy: timestamp, orderDirection: desc, where: 
    { 
      market: $market,
      period: ${SnapshotPeriod.OneHour}
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

export default async function fetchLatestNetGreeks(lyra: Lyra, market: Market): Promise<MarketNetGreeksSnapshot> {
  const { data } = await subgraphRequest<
    { marketGreeksSnapshots: MarketGreeksSnapshotQueryResult[] },
    { market: string }
  >(lyra.subgraphClient, {
    query: marketGreeksSnapshotsQuery,
    variables: {
      market: market.address.toLowerCase(),
    },
  })

  if (!data || data.marketGreeksSnapshots.length === 0) {
    return { ...EMPTY, timestamp: market.block.timestamp }
  }

  const marketGreeksSnapshot = data.marketGreeksSnapshots[0]
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
}
