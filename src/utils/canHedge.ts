import { BigNumber } from 'ethers'

import { UNIT } from '../constants/bn'
import { PoolHedgerView } from '../market'

export default function canHedge(spotPrice: BigNumber, increasesPoolDelta: boolean, hedgerView: PoolHedgerView) {
  const { expectedHedge, currentHedge, gmxView, futuresPoolHedgerParams } = hedgerView

  if (!futuresPoolHedgerParams.vaultLiquidityCheckEnabled) {
    return true
  }

  const expectedHedgeAbs = expectedHedge.abs()
  const currentHedgeAbs = currentHedge.abs()
  if (!futuresPoolHedgerParams) {
    return true
  }
  if (expectedHedgeAbs.lte(currentHedgeAbs)) {
    // Delta is shrinking (potentially flipping, but still smaller than current hedge), so we skip the check
    return true
  }

  // expected hedge is positive, and trade increases delta of the pool - risk is reduced, so accept trade
  if (increasesPoolDelta && expectedHedge.gte(0)) {
    return true
  }

  // expected hedge is negative, and trade decreases delta of the pool - risk is reduced, so accept trade
  if (!increasesPoolDelta && expectedHedge.lte(0)) {
    return true
  }

  // Figure out the amount of remaining dollars for the specific direction the pool needs to hedge
  let remainingDollars: BigNumber
  if (expectedHedge.gt(0)) {
    const { remainingLongDollars } = gmxView
    remainingDollars = remainingLongDollars
  } else {
    const { remainingShortDollars } = gmxView
    remainingDollars = remainingShortDollars
  }
  // Convert the dollar amount to deltas by dividing by spot.
  const remainingDeltas = remainingDollars.div(spotPrice).mul(UNIT)

  const absHedgeDiff = expectedHedgeAbs.sub(currentHedgeAbs)
  if (remainingDeltas.lt(absHedgeDiff.mul(futuresPoolHedgerParams.marketDepthBuffer).div(UNIT))) {
    return false
  }

  return true
}
