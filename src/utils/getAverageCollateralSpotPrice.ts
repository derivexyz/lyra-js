import { BigNumber } from '@ethersproject/bignumber'

import { CollateralUpdateEvent, Position } from '..'
import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { Trade } from '../trade'

export default function getAverageCollateralSpotPrice(
  position: Position,
  collateralUpdates: (CollateralUpdateEvent | Trade)[]
): BigNumber {
  // Skip longs
  if (position.isLong || !position.collateral || !collateralUpdates.length) {
    return ZERO_BN
  }
  // Dollar collateral always $1
  if (!position.collateral.isBase) {
    return ONE_BN
  }

  const firstCollateralUpdate = collateralUpdates[0]

  const firstCollateralAmount =
    firstCollateralUpdate instanceof CollateralUpdateEvent
      ? firstCollateralUpdate.amount
      : firstCollateralUpdate.collateral?.amount ?? ZERO_BN

  const firstSpotPrice =
    firstCollateralUpdate instanceof CollateralUpdateEvent
      ? firstCollateralUpdate.spotPrice
      : firstCollateralUpdate.market().spotPrice

  let currCollateralAmount = firstCollateralAmount
  let averageSpotPrice = firstSpotPrice

  for (const collateralUpdate of collateralUpdates.slice(1)) {
    const prevCollateralAmount = currCollateralAmount

    currCollateralAmount =
      collateralUpdate instanceof CollateralUpdateEvent
        ? collateralUpdate.amount
        : collateralUpdate.collateral?.amount ?? ZERO_BN

    const collateralChange = currCollateralAmount.sub(prevCollateralAmount)

    // Update rolling average if adding collateral
    if (collateralChange.gt(0)) {
      const prevTotalValue = averageSpotPrice.mul(prevCollateralAmount).div(UNIT)

      const spotPrice =
        collateralUpdate instanceof CollateralUpdateEvent
          ? collateralUpdate.spotPrice
          : collateralUpdate.market().spotPrice
      const addedCollateralValue = collateralChange.mul(spotPrice).div(UNIT)

      const newTotalValue = prevTotalValue.add(addedCollateralValue)

      averageSpotPrice = newTotalValue.mul(UNIT).div(currCollateralAmount)
    }
  }

  return averageSpotPrice
}
