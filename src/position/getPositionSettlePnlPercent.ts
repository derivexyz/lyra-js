import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import getPositionSettlePnl from './getPositionSettlePnl'

export default function getPositionSettlePnlPercent(position: Position): BigNumber {
  const settlePnl = getPositionSettlePnl(position)
  const settlePnlPerOption = settlePnl.mul(UNIT).div(position.size)
  const avgCostPerOption = position.avgCostPerOption()
  return avgCostPerOption.gt(0) ? settlePnlPerOption.mul(UNIT).div(avgCostPerOption) : ZERO_BN
}
