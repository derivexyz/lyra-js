import { gql } from '@apollo/client/core'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra, { Market, MarketLiquiditySnapshot } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import {
  MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT,
  MarketTotalValueSnapshotQueryResult,
  SnapshotPeriod,
} from '../constants/queries'
import fromBigNumber from './fromBigNumber'
import subgraphRequest from './subgraphRequest'

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

const EMPTY: Omit<MarketLiquiditySnapshot, 'market' | 'timestamp'> = {
  tvl: ZERO_BN,
  freeLiquidity: ZERO_BN,
  burnableLiquidity: ZERO_BN,
  utilization: 0,
  reservedCollatLiquidity: ZERO_BN,
  pendingDeltaLiquidity: ZERO_BN,
  usedDeltaLiquidity: ZERO_BN,
  tokenPrice: ZERO_BN,
  pendingDeposits: ZERO_BN,
  pendingWithdrawals: ZERO_BN,
}

export default async function fetchLatestLiquidity(lyra: Lyra, market: Market): Promise<MarketLiquiditySnapshot> {
  if (market.liveBoards().length === 0) {
    // No boards, deposits only
    return {
      market,
      tvl: market.params.NAV,
      freeLiquidity: market.params.NAV,
      burnableLiquidity: ZERO_BN,
      utilization: 0,
      reservedCollatLiquidity: ZERO_BN,
      pendingDeltaLiquidity: ZERO_BN,
      usedDeltaLiquidity: ZERO_BN,
      tokenPrice: market.params.tokenPrice,
      pendingDeposits: ZERO_BN,
      pendingWithdrawals: ZERO_BN,
      timestamp: market.block.timestamp,
    }
  }

  const { data } = await subgraphRequest<
    { marketTotalValueSnapshots: MarketTotalValueSnapshotQueryResult[] },
    { market: string }
  >(lyra.subgraphClient, {
    query: marketTotalValueSnapshotsQuery,
    variables: {
      market: market.address.toLowerCase(),
    },
  })

  if (!data || data.marketTotalValueSnapshots.length === 0) {
    return { ...EMPTY, market, timestamp: market.block.timestamp }
  }

  const latestLiquiditySnapshot = data.marketTotalValueSnapshots[0]
  const freeLiquidity = BigNumber.from(latestLiquiditySnapshot.freeLiquidity)
  const burnableLiquidity = BigNumber.from(latestLiquiditySnapshot.burnableLiquidity)
  const tvl = BigNumber.from(latestLiquiditySnapshot.NAV)
  const usedCollatLiquidity = BigNumber.from(latestLiquiditySnapshot.usedCollatLiquidity)
  const pendingDeltaLiquidity = BigNumber.from(latestLiquiditySnapshot.pendingDeltaLiquidity)
  const usedDeltaLiquidity = BigNumber.from(latestLiquiditySnapshot.usedDeltaLiquidity)
  const tokenPrice = BigNumber.from(latestLiquiditySnapshot.tokenPrice)

  return {
    market,
    timestamp: latestLiquiditySnapshot.timestamp,
    freeLiquidity,
    burnableLiquidity,
    tvl,
    utilization: tvl.gt(0) ? fromBigNumber(tvl.sub(freeLiquidity).mul(UNIT).div(tvl)) : 0,
    reservedCollatLiquidity: usedCollatLiquidity,
    pendingDeltaLiquidity: pendingDeltaLiquidity,
    usedDeltaLiquidity: usedDeltaLiquidity,
    tokenPrice,
    pendingDeposits: BigNumber.from(latestLiquiditySnapshot.pendingDeposits),
    pendingWithdrawals: BigNumber.from(latestLiquiditySnapshot.pendingWithdrawals),
  }
}
