import { gql } from '@apollo/client'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import { MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT, MarketTotalValueSnapshotQueryResult } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Market, MarketLiquiditySnapshot } from '../market'
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

const EMPTY: Omit<MarketLiquiditySnapshot, 'timestamp'> = {
  freeLiquidity: ZERO_BN,
  burnableLiquidity: ZERO_BN,
  tvl: ZERO_BN,
  utilization: 0,
  reservedCollatLiquidity: ZERO_BN,
  pendingDeltaLiquidity: ZERO_BN,
  usedDeltaLiquidity: ZERO_BN,
  tokenPrice: ZERO_BN,
  pendingDeposits: ZERO_BN,
  pendingWithdrawals: ZERO_BN,
}

export default async function fetchLiquidityHistory(
  lyra: Lyra,
  market: Market,
  options?: SnapshotOptions
): Promise<MarketLiquiditySnapshot[]> {
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
    {
      ...options,
      endTimestamp: options?.endTimestamp ?? market.block.timestamp,
    }
  )

  if (data.length === 0) {
    // Always return at least 1 snapshot
    return [{ ...EMPTY, timestamp: market.block.timestamp }]
  }

  const marketLiquidity = data.map(marketTotalValueSnapshot => {
    const freeLiquidityBN = BigNumber.from(marketTotalValueSnapshot.freeLiquidity)
    const burnableLiquidityBN = BigNumber.from(marketTotalValueSnapshot.burnableLiquidity)
    const tvl = BigNumber.from(marketTotalValueSnapshot.NAV)
    // TODO @michaelxuwu confirm with Paul if this field will be updated with Newport
    const usedCollatLiquidityBN = BigNumber.from(marketTotalValueSnapshot.usedCollatLiquidity)
    const pendingDeltaLiquidityBN = BigNumber.from(marketTotalValueSnapshot.pendingDeltaLiquidity)
    const usedDeltaLiquidityBN = BigNumber.from(marketTotalValueSnapshot.usedDeltaLiquidity)
    const tokenPriceBN = BigNumber.from(marketTotalValueSnapshot.tokenPrice)
    return {
      freeLiquidity: freeLiquidityBN,
      burnableLiquidity: burnableLiquidityBN,
      tvl,
      utilization: tvl.gt(0) ? fromBigNumber(tvl.sub(freeLiquidityBN).mul(UNIT).div(tvl)) : 0,
      totalWithdrawingDeposits: ZERO_BN, // TODO: paul said he will add
      reservedCollatLiquidity: usedCollatLiquidityBN,
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
