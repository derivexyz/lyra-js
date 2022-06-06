import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_GREEKS_SNAPSHOT_FRAGMENT, MarketGreeksSnapshotQueryResult } from '../constants/queries'
import { Market, MarketNetDelta } from '../market'

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

export default async function fetchNetDeltaHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  period: number
): Promise<MarketNetDelta[]> {
  const res = await lyra.subgraphClient.request<
    { marketGreeksSnapshots: MarketGreeksSnapshotQueryResult[] },
    MarketGreeksSnapshotVariables
  >(marketGreeksSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })
  const currentDate = Math.floor(new Date().getTime() / 1000)
  const marketNetDelta: MarketNetDelta[] = res.marketGreeksSnapshots
    .filter(snapshot => snapshot.timestamp <= currentDate)
    .map((marketGreeksSnapshot: MarketGreeksSnapshotQueryResult) => {
      return {
        netDelta: BigNumber.from(marketGreeksSnapshot.netDelta),
        timestamp: marketGreeksSnapshot.timestamp,
        // TODO: Add whether snapshot included deltaHedging - isDeltaHedge
      }
    })
  return marketNetDelta
}
