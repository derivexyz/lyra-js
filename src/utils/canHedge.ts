import { UNIT } from '../constants/bn'
import { MarketToken, PoolHedgerView } from '../market'
import { to18DecimalBN } from './convertBNDecimals'

export default function canHedge(
  increasesPoolDelta: boolean,
  hedgerView: PoolHedgerView,
  baseToken: MarketToken,
  quoteToken: MarketToken
) {
  const { expectedHedge, currentHedge, gmxView, futuresPoolHedgerParams } = hedgerView
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

  let remainingDeltas
  if (expectedHedge.gt(0)) {
    const { basePoolAmount, baseReservedAmount } = gmxView
    // remaining is the amount of baseAsset that can be hedged (adjusted from base token decimals)
    remainingDeltas = to18DecimalBN(basePoolAmount.sub(baseReservedAmount), baseToken.decimals)
  } else {
    const { quotePoolAmount, quoteReservedAmount } = gmxView
    // Adjusted from quote token decimals
    remainingDeltas = to18DecimalBN(quotePoolAmount.sub(quoteReservedAmount), quoteToken.decimals)
  }

  const absHedgeDiff = expectedHedgeAbs.sub(currentHedgeAbs)
  if (remainingDeltas.lt(absHedgeDiff.mul(futuresPoolHedgerParams.marketDepthBuffer).div(UNIT))) {
    return false
  }

  return true
}
