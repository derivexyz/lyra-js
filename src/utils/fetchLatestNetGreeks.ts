import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult, SnapshotPeriod } from '../constants/queries'
import { Market, MarketNetGreeks } from '../market'

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

export default async function fetchLatestNetGreeks(lyra: Lyra, market: Market): Promise<MarketNetGreeks> {
  const data = await lyra.subgraphClient.request<
    { marketGreeksSnapshots: MarketGreeksSnapshotQueryResult[] },
    { market: string }
  >(marketGreeksSnapshotsQuery, {
    market: market.address.toLowerCase(),
  })
  return data.marketGreeksSnapshots.map(marketGreeksSnapshot => {
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
  })[0]
}
