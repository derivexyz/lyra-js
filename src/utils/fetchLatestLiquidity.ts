import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import Lyra, { MarketLiquidity } from '..'
import { UNIT } from '../constants/bn'
import {
  MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT,
  MarketTotalValueSnapshotQueryResult,
  SnapshotPeriod,
} from '../constants/queries'
import fromBigNumber from './fromBigNumber'

const marketTotalValueSnapshotsQuery = gql`
  query marketTotalValueSnapshots(
    $market: String!
  ) {
    marketTotalValueSnapshots(
      first: 1, orderBy: timestamp, orderDirection: desc, where: { 
        market: $market, 
        NAV_gt: 0,
        period: ${SnapshotPeriod.OneHour}
      }
    ) {
      ${MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchLatestLiquidity(lyra: Lyra, marketAddress: string): Promise<MarketLiquidity> {
  const data = await lyra.subgraphClient.request<
    { marketTotalValueSnapshots: MarketTotalValueSnapshotQueryResult[] },
    { market: string }
  >(marketTotalValueSnapshotsQuery, {
    market: marketAddress.toLowerCase(),
  })
  const latestLiquiditySnapshot = data.marketTotalValueSnapshots[0]
  const freeLiquidity = BigNumber.from(latestLiquiditySnapshot.freeLiquidity)
  const burnableLiquidity = BigNumber.from(latestLiquiditySnapshot.burnableLiquidity)
  const nav = BigNumber.from(latestLiquiditySnapshot.NAV)
  const usedCollatLiquidity = BigNumber.from(latestLiquiditySnapshot.usedCollatLiquidity)
  const pendingDeltaLiquidity = BigNumber.from(latestLiquiditySnapshot.pendingDeltaLiquidity)
  const usedDeltaLiquidity = BigNumber.from(latestLiquiditySnapshot.usedDeltaLiquidity)
  const tokenPrice = BigNumber.from(latestLiquiditySnapshot.tokenPrice)

  return {
    freeLiquidity,
    burnableLiquidity,
    nav,
    utilization: nav.gt(0) ? fromBigNumber(nav.sub(freeLiquidity).mul(UNIT).div(nav)) : 0,
    reservedCollatLiquidity: usedCollatLiquidity,
    pendingDeltaLiquidity: pendingDeltaLiquidity,
    usedDeltaLiquidity: usedDeltaLiquidity,
    tokenPrice,
    totalQueuedDeposits: BigNumber.from(latestLiquiditySnapshot.pendingDeposits),
    totalWithdrawingDeposits: BigNumber.from(latestLiquiditySnapshot.pendingWithdrawals),
  }
}
