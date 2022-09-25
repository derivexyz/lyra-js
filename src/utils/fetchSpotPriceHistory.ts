import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { SPOT_PRICE_SNAPSHOT_FRAGMENT, SpotPriceSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { MarketSpotPrice } from '../market'
import fetchSnapshots from './fetchSnapshots'

const spotPriceSnapshotsQuery = gql`
  query spotPriceSnapshots(
    $market: String!, $min: Int!, $max: Int! $period: Int!
  ) {
    spotPriceSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: { 
      market: $market, 
      timestamp_gte: $min, 
      timestamp_lte: $max,
      period_gte: $period 
    }) {
      ${SPOT_PRICE_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchSpotPriceHistory(
  lyra: Lyra,
  marketAddress: string,
  options?: SnapshotOptions
): Promise<MarketSpotPrice[]> {
  const data = await fetchSnapshots<
    SpotPriceSnapshotQueryResult,
    {
      market: string
    }
  >(
    lyra,
    spotPriceSnapshotsQuery,
    {
      market: marketAddress.toLowerCase(),
    },
    options
  )
  return data.map(spotPriceSnapshot => ({
    spotPrice: BigNumber.from(spotPriceSnapshot.spotPrice),
    timestamp: spotPriceSnapshot.timestamp,
    blockNumber: spotPriceSnapshot.blockNumber,
  }))
}
