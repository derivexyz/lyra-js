import { BigNumber } from 'ethers'

import { Position } from '..'
import { ZERO_BN } from '../constants/bn'
import getSettlePnl from '../utils/getSettlePnl'

// Realized pnl for settled positions
export default function getPositionSettlePnl(position: Position): BigNumber {
  const { isLong, isCall, spotPriceAtExpiry, strikePrice, size } = position
  const averageCostPerOption = position.avgCostPerOption()

  if (!spotPriceAtExpiry) {
    // Position has not settled
    return ZERO_BN
  }

  // Ignore base collateral
  // Ignore liquidations which are accounted for in realized pnl
  return getSettlePnl(isLong, isCall, strikePrice, spotPriceAtExpiry, averageCostPerOption, size)
}
