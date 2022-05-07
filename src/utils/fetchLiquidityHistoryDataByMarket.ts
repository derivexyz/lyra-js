import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import {
  MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT,
  MarketTotalValueSnapshotQueryResult,
  MetaQueryResult,
} from '../constants/queries'
import { Market, MarketLiquidity } from '../market'

const marketTotalValueSnapshotsQuery = gql`
  query marketTotalValueSnapshots(
    $market: String, $startTimestamp: Int, $period: Int
  ) {
    marketTotalValueSnapshots(
      first: 1000, orderBy: timestamp, orderDirection: asc, where: { 
        market: $market, 
        timestamp_gte: $startTimestamp, 
        period_gte: $period 
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
  period: number
): Promise<{ liquidity: MarketLiquidity[] }> {
  const res = await lyra.subgraphClient.request<
    { marketTotalValueSnapshots: MarketTotalValueSnapshotQueryResult[]; _meta: MetaQueryResult },
    MarketTotalValueSnapshotVariables
  >(marketTotalValueSnapshotsQuery, {
    market: market.address.toLowerCase(),
    startTimestamp,
    period,
  })
  const marketLiquidity = res.marketTotalValueSnapshots.map(
    (marketTotalValueSnapshot: MarketTotalValueSnapshotQueryResult) => {
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
        utilization: NAVBN.gt(0) ? NAVBN.sub(freeLiquidityBN).mul(UNIT).div(NAVBN) : ZERO_BN,
        totalWithdrawingDeposits: ZERO_BN, // TODO: paul said he will add
        usedCollatLiquidity: usedCollatLiquidityBN,
        pendingDeltaLiquidity: pendingDeltaLiquidityBN,
        usedDeltaLiquidity: usedDeltaLiquidityBN,
        tokenPrice: tokenPriceBN,
        timestamp: marketTotalValueSnapshot.timestamp,
      }
    }
  )
  return {
    liquidity: marketLiquidity,
  }
}
