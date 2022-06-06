import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'
import getTradeRealizedPnl from './getTradeRealizedPnl'

export default function getTradeRealizedPnlPercent(position: Position, closeTrade: TradeEvent | Trade): BigNumber {
  const realizedPnl = getTradeRealizedPnl(position, closeTrade)
  const realizedPnlPerOption = closeTrade.size.gt(0) ? realizedPnl.mul(UNIT).div(closeTrade.size) : ZERO_BN
  const avgCostPerOption =
    closeTrade instanceof TradeEvent ? closeTrade.newAvgCostPerOptionSync(position) : closeTrade.newAvgCostPerOption()
  return avgCostPerOption.gt(0) ? realizedPnlPerOption.mul(UNIT).div(avgCostPerOption) : ZERO_BN
}
