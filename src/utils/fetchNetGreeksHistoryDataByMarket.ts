import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult } from '../constants/queries'
import { Market, MarketNetGreeks } from '../market'
import getSnapshotPeriod from './getSnapshotPeriod'

const marketGreeksSnapshotsQuery = gql`
  query marketGreeksSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    marketGreeksSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${MARKET_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

type MarketGreeksSnapshotVariables = {
  market: string
  startTimestamp: number
  period: number
}

export default async function fetchNetGreeksHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  endTimestamp: number
): Promise<MarketNetGreeks[]> {
  const { marketGreeksSnapshots } = await lyra.subgraphClient.request<
    {
      marketGreeksSnapshots: MarketGreeksSnapshotQueryResult[]
    },
    MarketGreeksSnapshotVariables
  >(marketGreeksSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp),
  })

  return marketGreeksSnapshots.map(marketGreeksSnapshot => {
    // Pool net delta = greek cache (options) net delta + base balance
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
