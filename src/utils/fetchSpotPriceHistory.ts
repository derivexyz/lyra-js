import { gql } from '@apollo/client/core'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import {
  MIN_START_TIMESTAMP,
  SnapshotPeriod,
  SPOT_PRICE_SNAPSHOT_FRAGMENT,
  SpotPriceSnapshotQueryResult,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketSpotCandle } from '../market'
import getSnapshotPeriod from './getSnapshotPeriod'
import subgraphRequestWithLoop from './subgraphRequestWithLoop'

const SPOT_PRICE_SNAPSHOT_LIMIT = 10000

const spotPriceSnapshotsQuery = gql`
  query spotPriceSnapshots(
    $market: String!, $min: Int!, $max: Int!, $period: Int!, $limit: Int!
  ) {
    spotPriceSnapshots(first: $limit, orderBy: timestamp, orderDirection: asc, where: { 
      market: $market, 
      timestamp_gte: $min, 
      timestamp_lte: $max,
      period: $period 
    }) {
      ${SPOT_PRICE_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchSpotPriceHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketSpotCandle[]> {
  const startTimestamp = options?.startTimestamp ?? MIN_START_TIMESTAMP
  const endTimestamp = options?.endTimestamp ?? market.block.timestamp
  const candleDuration =
    options?.period ??
    getSnapshotPeriod(startTimestamp, endTimestamp, [
      SnapshotPeriod.FifteenMinutes,
      SnapshotPeriod.OneHour,
      SnapshotPeriod.FourHours,
      SnapshotPeriod.EightHours,
      SnapshotPeriod.OneDay,
      SnapshotPeriod.SevenDays,
    ])

  const estNumCandles = candleDuration > 0 ? (endTimestamp - startTimestamp) / candleDuration : 0
  const numBatches = Math.ceil(estNumCandles / SPOT_PRICE_SNAPSHOT_LIMIT)
  const data = await subgraphRequestWithLoop<SpotPriceSnapshotQueryResult>(
    lyra,
    spotPriceSnapshotsQuery,
    {
      min: startTimestamp,
      max: endTimestamp,
      limit: SPOT_PRICE_SNAPSHOT_LIMIT,
      period: candleDuration,
      market: market.address.toLowerCase(),
    },
    'timestamp',
    {
      increment: SPOT_PRICE_SNAPSHOT_LIMIT * candleDuration,
      batch: numBatches,
    }
  )

  if (data.length === 0) {
    return []
  }

  const candles = data.map(spotPriceSnapshot => ({
    open: BigNumber.from(spotPriceSnapshot.open),
    high: BigNumber.from(spotPriceSnapshot.high),
    low: BigNumber.from(spotPriceSnapshot.low),
    close: BigNumber.from(spotPriceSnapshot.close),
    startTimestamp: spotPriceSnapshot.timestamp - spotPriceSnapshot.period,
    endTimestamp: spotPriceSnapshot.timestamp,
    period: spotPriceSnapshot.period,
    startBlockNumber: spotPriceSnapshot.blockNumber,
  }))

  const latestCandle = candles.length ? candles[candles.length - 1] : null
  if (latestCandle && latestCandle.endTimestamp > market.block.number) {
    // Update close
    latestCandle.close = market.spotPrice
    // Update low
    if (market.spotPrice.lt(latestCandle.low)) {
      latestCandle.low = market.spotPrice
    }
    // Update high
    if (market.spotPrice.gt(latestCandle.high)) {
      latestCandle.low = market.spotPrice
    }
  }

  return candles
}
