import { BigNumber } from 'ethers'

import { Position } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'

// Realized pnl for settled positions
export default function getPositionSettlePnl(position: Position): BigNumber {
  const { isLong, isCall, spotPriceAtExpiry, strikePrice, size } = position
  const averageCostPerOption = position.avgCostPerOption()

  if (!spotPriceAtExpiry) {
    // Position has not settled
    return ZERO_BN
  }

  if (isLong) {
    if (isCall) {
      // Long call
      return (
        spotPriceAtExpiry.gt(strikePrice)
          ? // ITM
            spotPriceAtExpiry.sub(strikePrice).sub(averageCostPerOption)
          : // OTM
            averageCostPerOption.mul(-1)
      )
        .mul(size)
        .div(UNIT)
    } else {
      // Long put
      return (
        spotPriceAtExpiry.lt(strikePrice)
          ? // ITM
            strikePrice.sub(spotPriceAtExpiry).sub(averageCostPerOption)
          : // OTM
            averageCostPerOption.mul(-1)
      )
        .mul(size)
        .div(UNIT)
    }
  } else {
    if (isCall) {
      // Covered + naked call
      // TODO: @earthtojake Account for base collateral
      return (
        spotPriceAtExpiry.lte(strikePrice)
          ? // OTM
            averageCostPerOption
          : // ITM
            averageCostPerOption.sub(spotPriceAtExpiry).add(strikePrice)
      )
        .mul(size)
        .div(UNIT)
    } else {
      // Cash secured put
      return (
        spotPriceAtExpiry.lte(strikePrice)
          ? // ITM
            spotPriceAtExpiry.sub(strikePrice).add(averageCostPerOption)
          : // OTM
            averageCostPerOption
      )
        .mul(size)
        .div(UNIT)
    }
  }
}
