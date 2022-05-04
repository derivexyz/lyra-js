import { BigNumber } from '@ethersproject/bignumber'

import { MAX_BN, UNIT, ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import fromBigNumber from './fromBigNumber'
import getMaxCollateral from './getMaxCollateral'
import getMinCollateralForSpotPrice from './getMinCollateralForSpotPrice'

const MAX_ITERATIONS = 20

const closeToPercentage = (a: BigNumber, b: BigNumber, percentage: number) =>
  b.gt(0) ? fromBigNumber(b.sub(a).mul(UNIT).div(b).abs()) <= percentage : a.eq(b) // zero comparison

export default function getLiquidationPrice(
  option: Option,
  size: BigNumber,
  collateral: BigNumber,
  isBaseCollateral?: boolean
) {
  const board = option.board()
  const timeToExpiry = board.timeToExpiry

  const minCollateral = getMinCollateralForSpotPrice(option, size, option.market().spotPrice, isBaseCollateral, true)
  const maxCollateral = getMaxCollateral(option, size, isBaseCollateral)

  if (timeToExpiry <= 0 || size.eq(0) || collateral.eq(0)) {
    return ZERO_BN
  } else if (collateral.gte(maxCollateral) && !(option.isCall && !isBaseCollateral)) {
    // Fully collateralized cash secured puts and covered calls are not liquidatable
    return MAX_BN
  } else if (collateral.lt(minCollateral)) {
    // Position is immediately liquidatable
    return option.market().spotPrice
  }
  // Acceptable spot price range: 0 to 100x spot
  let low: BigNumber = ZERO_BN
  let high: BigNumber = option.market().spotPrice.mul(100)
  let n = 0
  while (low.lt(high) && n < MAX_ITERATIONS) {
    // Search for price liquidation match
    const mid = low.add(high).div(2)
    // Get the largest min collateral value for a given spot price
    const currMinCollateral = getMinCollateralForSpotPrice(option, size, mid, isBaseCollateral, true)
    if (closeToPercentage(currMinCollateral, collateral, 0.001)) {
      return mid
    }
    if (option.isCall) {
      if (collateral.lt(currMinCollateral)) {
        high = mid
      } else {
        low = mid
      }
    } else {
      // Search opposite direction for short puts
      if (collateral.lt(currMinCollateral)) {
        low = mid
      } else {
        high = mid
      }
    }
    n++
  }
  console.warn('Failed to find liquidation price', { low: fromBigNumber(low), high: fromBigNumber(high) })
  return low.add(high).div(2)
}
