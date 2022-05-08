import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT, MarketVolumeAndFeesSnapshotQueryResult } from '../constants/queries'
import { Market, MarketTradingVolumeHistory } from '../market'

const marketVolumeAndFeesSnapshotsQuery = gql`
  query marketVolumeAndFeesSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    marketVolumeAndFeesSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: {
      market: $market, 
      timestamp_gte: $startTimestamp, 
      period_gte: $period 
    }) {
      ${MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT}
    }
  }
`

type MarketVolumeAndFeesSnapshotVariables = {
  market: string
  startTimestamp: number
  period: number
}

export default async function fetchTradingVolumeHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  period: number
): Promise<MarketTradingVolumeHistory[]> {
  const res = await lyra.subgraphClient.request<
    { marketVolumeAndFeesSnapshots: MarketVolumeAndFeesSnapshotQueryResult[] },
    MarketVolumeAndFeesSnapshotVariables
  >(marketVolumeAndFeesSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })

  const tradingVolume: MarketTradingVolumeHistory[] = res.marketVolumeAndFeesSnapshots.map(
    (marketVolumeAndFeesSnapshot: MarketVolumeAndFeesSnapshotQueryResult) => {
      return {
        premiumVolume: BigNumber.from(marketVolumeAndFeesSnapshot.premiumVolume),
        notionalVolume: BigNumber.from(marketVolumeAndFeesSnapshot.notionalVolume),
        totalPremiumVolume: BigNumber.from(marketVolumeAndFeesSnapshot.totalPremiumVolume),
        totalNotionalVolume: BigNumber.from(marketVolumeAndFeesSnapshot.totalNotionalVolume),
        spotPriceFees: BigNumber.from(marketVolumeAndFeesSnapshot.spotPriceFees),
        optionPriceFees: BigNumber.from(marketVolumeAndFeesSnapshot.optionPriceFees),
        vegaFees: BigNumber.from(marketVolumeAndFeesSnapshot.vegaFees),
        deltaCutoffFees: BigNumber.from(marketVolumeAndFeesSnapshot.deltaCutoffFees),
        liquidatorFees: BigNumber.from(marketVolumeAndFeesSnapshot.liquidatorFees),
        smLiquidationFees: BigNumber.from(marketVolumeAndFeesSnapshot.smLiquidationFees),
        lpLiquidationFees: BigNumber.from(marketVolumeAndFeesSnapshot.lpLiquidationFees),
        timestamp: marketVolumeAndFeesSnapshot.timestamp,
      }
    }
  )

  return tradingVolume
}
