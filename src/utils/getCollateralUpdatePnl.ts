import { BigNumber } from 'ethers'

import { CollateralUpdateEvent } from '../collateral_update_event'
import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { Trade } from '../trade'

export default function getCollateralUpdatePnl(
  position: Position,
  collateralUpdate: CollateralUpdateEvent | Trade
): BigNumber {
  const changeAmount =
    collateralUpdate instanceof CollateralUpdateEvent
      ? collateralUpdate.changeAmount(position)
      : collateralUpdate.collateralChangeAmount()

  const isBaseCollateral =
    collateralUpdate instanceof CollateralUpdateEvent
      ? collateralUpdate.isBaseCollateral
      : !!collateralUpdate.collateral?.isBase

  if (!isBaseCollateral || changeAmount.gt(0)) {
    // No profitability for stable collateral or adding base collateral
    return ZERO_BN
  }

  // average spot until collateral update
  const averageSpotPrice = collateralUpdate.prevAverageCollateralSpotPrice(position)
  const spotPrice = position.market().spotPrice

  // Profit is fair value minus average locked spot price
  return spotPrice.sub(averageSpotPrice).mul(changeAmount).div(UNIT)
}
