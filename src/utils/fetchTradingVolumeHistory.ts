import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import {
  MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT,
  MarketVolumeAndFeesSnapshotQueryResult,
  MAX_END_TIMESTAMP,
  MIN_START_TIMESTAMP,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketTradingVolumeHistory } from '../market'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const marketVolumeAndFeesSnapshotsQuery = gql`
  query marketVolumeAndFeesSnapshots(
    $market: String!, $min: Int!, $max: Int!, $period: Int!
  ) {
    marketVolumeAndFeesSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: {
      market: $market, 
      timestamp_gte: $min, 
      timestamp_lte: $max, 
      period: $period
    }) {
      ${MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchTradingVolumeHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketTradingVolumeHistory[]> {
  const startTimestamp = options?.startTimestamp ?? MIN_START_TIMESTAMP
  const endTimestamp = options?.endTimestamp ?? MAX_END_TIMESTAMP
  const period = getSnapshotPeriod(startTimestamp, endTimestamp)
  const data = await fetchSnapshots<MarketVolumeAndFeesSnapshotQueryResult, { market: string }>(
    lyra,
    marketVolumeAndFeesSnapshotsQuery,
    {
      market: market.address.toLowerCase(),
    },
    options
  )
  return data.map((marketVolumeAndFeesSnapshot: MarketVolumeAndFeesSnapshotQueryResult) => {
    return {
      premiumVolume: BigNumber.from(marketVolumeAndFeesSnapshot.premiumVolume),
      notionalVolume: BigNumber.from(marketVolumeAndFeesSnapshot.notionalVolume),
      totalPremiumVolume: BigNumber.from(marketVolumeAndFeesSnapshot.totalPremiumVolume),
      totalNotionalVolume: BigNumber.from(marketVolumeAndFeesSnapshot.totalNotionalVolume),
      spotPriceFees: BigNumber.from(marketVolumeAndFeesSnapshot.spotPriceFees),
      optionPriceFees: BigNumber.from(marketVolumeAndFeesSnapshot.optionPriceFees),
      vegaFees: BigNumber.from(marketVolumeAndFeesSnapshot.vegaFees),
      varianceFees: BigNumber.from(marketVolumeAndFeesSnapshot.varianceFees),
      deltaCutoffFees: BigNumber.from(marketVolumeAndFeesSnapshot.deltaCutoffFees),
      liquidatorFees: BigNumber.from(marketVolumeAndFeesSnapshot.liquidatorFees),
      smLiquidationFees: BigNumber.from(marketVolumeAndFeesSnapshot.smLiquidationFees),
      lpLiquidationFees: BigNumber.from(marketVolumeAndFeesSnapshot.lpLiquidationFees),
      startTimestamp: marketVolumeAndFeesSnapshot.timestamp - period,
      endTimestamp: marketVolumeAndFeesSnapshot.timestamp,
    }
  })
}
