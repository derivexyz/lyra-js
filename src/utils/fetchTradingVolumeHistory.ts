import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import {
  MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT,
  MarketVolumeAndFeesSnapshotQueryResult,
  SnapshotPeriod,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketTradingVolumeHistory } from '../market'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const marketVolumeAndFeesSnapshotsQuery = gql`
  query marketVolumeAndFeesSnapshots(
    $market: String!, $startTimestamp: Int!, $endTimestamp: Int!, $period: Int!
  ) {
    marketVolumeAndFeesSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: {
      market: $market, 
      timestamp_gte: $startTimestamp, 
      timestamp_lte: $endTimestamp, 
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
  const startTimestamp = options?.startTimestamp ?? 0
  const endTimestamp = options?.endTimestamp ?? market.block.timestamp
  const data = await fetchSnapshots<MarketVolumeAndFeesSnapshotQueryResult, { market: string }>(
    lyra,
    marketVolumeAndFeesSnapshotsQuery,
    'marketVolumeAndFeesSnapshots',
    {
      market: market.address.toLowerCase(),
      startTimestamp,
      endTimestamp,
      period: SnapshotPeriod.OneHour,
    }
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
      startTimestamp: marketVolumeAndFeesSnapshot.timestamp - getSnapshotPeriod(startTimestamp, endTimestamp),
      endTimestamp: marketVolumeAndFeesSnapshot.timestamp,
    }
  })
}
