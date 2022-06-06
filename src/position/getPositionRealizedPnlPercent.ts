import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '.'
import getPositionSettlePnlPercent from './getPositionSettlePnlPercent'

export default function getPositionRealizedPnlPercent(position: Position): BigNumber {
  const trades = position.trades()

  let weightedPnlPercent = trades.reduce((weightedPnlPercent, trade) => {
    if (!trade.isOpen) {
      const pnlPercent = trade.realizedPnlPercentSync(position).mul(trade.size).div(UNIT)
      return weightedPnlPercent.add(pnlPercent)
    } else {
      return weightedPnlPercent
    }
  }, ZERO_BN)

  if (position.isSettled) {
    const settlePnlPercent = getPositionSettlePnlPercent(position)
    const weightedSettlePnlPercent = settlePnlPercent.mul(position.size).div(UNIT)
    weightedPnlPercent = weightedPnlPercent.add(weightedSettlePnlPercent)
  }

  // Total close + settle size
  const totalCloseSize = trades.reduce((sum, trade) => {
    if (!trade.isOpen) {
      return sum.add(trade.size)
    } else {
      return sum
    }
  }, ZERO_BN)

  const totalCloseAndSettleSize = position.isSettled ? totalCloseSize.add(position.size) : totalCloseSize

  return totalCloseAndSettleSize.gt(0) ? weightedPnlPercent.mul(UNIT).div(totalCloseAndSettleSize) : ZERO_BN
}
