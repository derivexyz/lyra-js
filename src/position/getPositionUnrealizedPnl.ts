import { BigNumber } from 'ethers'

import { Position } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'

// Unrealized pnl for a position is quoted black scholes price (without fees)
// Required to close 100% of the position
export default function getPositionUnrealizedPnl(position: Position): BigNumber {
  const { isLong, size, pricePerOption } = position
  const averageCostPerOption = position.avgCostPerOption()
  if (!position.isOpen) {
    // Trade is not a close or position is not open
    return ZERO_BN
  }
  return (isLong ? pricePerOption.sub(averageCostPerOption) : averageCostPerOption.sub(pricePerOption))
    .mul(size)
    .div(UNIT)
}
