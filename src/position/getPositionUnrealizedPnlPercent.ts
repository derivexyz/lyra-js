import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '.'

export default function getPositionUnrealizedPnlPercent(position: Position): BigNumber {
  const unrealizedPnl = position.unrealizedPnl()
  const unrealizedPnlPerOption = position.size.gt(0) ? unrealizedPnl.mul(UNIT).div(position.size) : ZERO_BN
  const avgCostPerOption = position.avgCostPerOption()
  return avgCostPerOption.gt(0) ? unrealizedPnlPerOption.mul(UNIT).div(avgCostPerOption) : ZERO_BN
}
