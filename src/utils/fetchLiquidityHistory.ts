import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import { MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT, MarketTotalValueSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketLiquidityHistory } from '../market'
import fetchSnapshots from './fetchSnapshots'
import fromBigNumber from './fromBigNumber'

const marketTotalValueSnapshotsQuery = gql`
  query marketTotalValueSnapshots(
    $market: String!, $min: Int!, $max: Int! $period: Int!
  ) {
    marketTotalValueSnapshots(
      first: 1000, orderBy: timestamp, orderDirection: asc, where: { 
        market: $market, 
        NAV_gt: 0
        timestamp_gte: $min, 
        timestamp_lte: $max,
        period: $period 
      }
    ) {
      ${MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchLiquidityHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketLiquidityHistory[]> {
  const data = await fetchSnapshots<
    MarketTotalValueSnapshotQueryResult,
    {
      market: string
    }
  >(
    lyra,
    marketTotalValueSnapshotsQuery,
    {
      market: market.address.toLowerCase(),
    },
    options
  )
  const marketLiquidity = data.map(marketTotalValueSnapshot => {
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
      utilization: NAVBN.gt(0) ? fromBigNumber(NAVBN.sub(freeLiquidityBN).mul(UNIT).div(NAVBN)) : 0,
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
