import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import getTradeRealizedPnl from '../utils/getTradeRealizedPnl'
import { Position } from '.'
import getPositionSettlePnl from './getPositionSettlePnl'

// Realized pnl for a position is the sum of all realized profits
// Realized profits come from closing trades and cash settlements
export default function getPositionRealizedPnl(position: Position): BigNumber {
  const trades = position.trades()

  const closePnl = trades.reduce((pnl, trade) => {
    if (!trade.isOpen) {
      return pnl.add(getTradeRealizedPnl(position, trade))
    } else {
      return pnl
    }
  }, ZERO_BN)

  const settlePnl = getPositionSettlePnl(position)

  return closePnl.add(settlePnl)
}
