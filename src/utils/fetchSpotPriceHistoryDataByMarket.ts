import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_SPOT_PRICE_SNAPSHOT_FRAGMENT, MarketSpotPriceSnapshotQueryResult } from '../constants/queries'
import { Market, MarketSpotPrice } from '../market'

const spotPriceSnapshotsQuery = gql`
  query spotPriceSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    spotPriceSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${MARKET_SPOT_PRICE_SNAPSHOT_FRAGMENT}
    }
  }
`

type SpotPriceSnapshotVariables = {
  market: string
  startTimestamp: number
  period: number
}

export default async function fetchSpotPriceHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  period: number
): Promise<MarketSpotPrice[]> {
  const res = await lyra.subgraphClient.request<
    { spotPriceSnapshots: MarketSpotPriceSnapshotQueryResult[] },
    SpotPriceSnapshotVariables
  >(spotPriceSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })
  const marketSpotPrice: MarketSpotPrice[] = res.spotPriceSnapshots.map(
    (spotPriceSnapshot: MarketSpotPriceSnapshotQueryResult) => {
      return {
        spotPrice: BigNumber.from(spotPriceSnapshot.spotPrice),
        timestamp: spotPriceSnapshot.timestamp,
      }
    }
  )
  return marketSpotPrice
}
