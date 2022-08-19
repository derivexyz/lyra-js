import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { SPOT_PRICE_SNAPSHOT_FRAGMENT, SpotPriceSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketSpotPrice } from '../market'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const spotPriceSnapshotsQuery = gql`
  query spotPriceSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    spotPriceSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { 
      market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${SPOT_PRICE_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchSpotPriceHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketSpotPrice[]> {
  const startTimestamp = options?.startTimestamp ?? 0
  const endTimestamp = options?.endTimestamp ?? market.block.timestamp
  const data = await fetchSnapshots<
    SpotPriceSnapshotQueryResult,
    {
      market: string
    }
  >(lyra, spotPriceSnapshotsQuery, 'spotPriceSnapshots', {
    market: market.address.toLowerCase(),
    startTimestamp,
    endTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp),
  })
  return data.map(spotPriceSnapshot => {
    return {
      spotPrice: BigNumber.from(spotPriceSnapshot.spotPrice),
      timestamp: spotPriceSnapshot.timestamp,
    }
  })
}
