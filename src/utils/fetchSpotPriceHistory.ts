import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { SPOT_PRICE_SNAPSHOT_FRAGMENT, SpotPriceSnapshotQueryResult } from '../constants/queries'
import Lyra from '../lyra'

type SpotPriceHistoryVariables = {
  market: string
  startTimestamp: number
  period: number
}

export const spotPriceQuery = gql`
  query spotPriceSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    spotPriceSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: {
        market: $market
        timestamp_gte: $startTimestamp,
        period_gte: $period
      }
    ) {
      ${SPOT_PRICE_SNAPSHOT_FRAGMENT}
    }
  }
`

export const fetchSpotPriceHistory = async (
  lyra: Lyra,
  marketAddress: string,
  startTimestamp: number,
  period: number
): Promise<
  {
    timestamp: number
    spotPrice: BigNumber
  }[]
> => {
  const res = await lyra.subgraphClient.request<
    { spotPriceSnapshots: SpotPriceSnapshotQueryResult[] },
    SpotPriceHistoryVariables
  >(spotPriceQuery, {
    market: marketAddress,
    startTimestamp,
    period,
  })
  return (
    res.spotPriceSnapshots.map(spotPrice => {
      return {
        timestamp: spotPrice.timestamp,
        spotPrice: BigNumber.from(spotPrice.spotPrice),
      }
    }) ?? []
  )
}
