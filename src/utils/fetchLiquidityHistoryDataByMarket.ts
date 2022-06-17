import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import {
  MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT,
  MarketTotalValueSnapshotQueryResult,
  MetaQueryResult,
} from '../constants/queries'
import { Market, MarketLiquidityHistory } from '../market'
import getSnapshotPeriod from './getSnapshotPeriod'

const marketTotalValueSnapshotsQuery = gql`
  query marketTotalValueSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    marketTotalValueSnapshots(
      first: 1000, orderBy: timestamp, orderDirection: asc, where: { 
        market: $market, 
        timestamp_gte: $startTimestamp, 
        period: $period 
        NAV_gt: 0
      }
    ) {
      ${MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT}
    }
  }
`

type MarketTotalValueSnapshotVariables = {
  market: string
  startTimestamp: number
  period: number
}

export default async function fetchLiquidityHistoryDataByMarket(
  lyra: Lyra,
  market: Market,
  startTimestamp: number,
  endTimestamp: number
): Promise<MarketLiquidityHistory[]> {
  const res = await lyra.subgraphClient.request<
    { marketTotalValueSnapshots: MarketTotalValueSnapshotQueryResult[]; _meta: MetaQueryResult },
    MarketTotalValueSnapshotVariables
  >(marketTotalValueSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp),
  })
  const currentDate = Math.floor(new Date().getTime() / 1000)
  const marketLiquidity = res.marketTotalValueSnapshots
    .filter(snapshot => snapshot.timestamp <= currentDate)
    .map((marketTotalValueSnapshot: MarketTotalValueSnapshotQueryResult) => {
      const freeLiquidityBN = BigNumber.from(marketTotalValueSnapshot.freeLiquidity)
      const burnableLiquidityBN = BigNumber.from(marketTotalValueSnapshot.burnableLiquidity)
      const NAVBN = BigNumber.from(marketTotalValueSnapshot.NAV)
      const usedCollatLiquidityBN = BigNumber.from(marketTotalValueSnapshot.usedCollatLiquidity)
      const pendingDeltaLiquidityBN = BigNumber.from(marketTotalValueSnapshot.pendingDeltaLiquidity)
      const usedDeltaLiquidityBN = BigNumber.from(marketTotalValueSnapshot.usedDeltaLiquidity)
      const tokenPriceBN = BigNumber.from(marketTotalValueSnapshot.tokenPrice)
      return {
        freeLiquidity: freeLiquidityBN,
        burnableLiquidity: burnableLiquidityBN,
        totalQueuedDeposits: ZERO_BN, // TODO: paul said he will add
        nav: NAVBN,
        utilization: NAVBN.gt(0) ? NAVBN.sub(freeLiquidityBN).mul(UNIT).div(NAVBN) : ZERO_BN,
        totalWithdrawingDeposits: ZERO_BN, // TODO: paul said he will add
        usedCollatLiquidity: usedCollatLiquidityBN,
        pendingDeltaLiquidity: pendingDeltaLiquidityBN,
        usedDeltaLiquidity: usedDeltaLiquidityBN,
        tokenPrice: tokenPriceBN,
        timestamp: marketTotalValueSnapshot.timestamp,
        pendingDeposits: BigNumber.from(marketTotalValueSnapshot.pendingDeposits),
        pendingWithdrawals: BigNumber.from(marketTotalValueSnapshot.pendingWithdrawals),
      }
    })
  return marketLiquidity
}
