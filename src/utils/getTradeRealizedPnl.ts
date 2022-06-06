import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'

// Realized pnl for closing trade on a position
export default function getTradeRealizedPnl(position: Position, closeTrade: TradeEvent | Trade): BigNumber {
  if (closeTrade.isOpen) {
    // Open events incur no realized pnl
    return ZERO_BN
  }

  const closeTradeSize = closeTrade.size
  const isCloseTradeLong = closeTrade.isLong
  const pricePerOption = closeTrade.pricePerOption
  const averageCostPerOption =
    closeTrade instanceof TradeEvent ? closeTrade.newAvgCostPerOptionSync(position) : closeTrade.newAvgCostPerOption()

  // TODO: @earthtojake account for collateral changes
  return (isCloseTradeLong ? pricePerOption.sub(averageCostPerOption) : averageCostPerOption.sub(pricePerOption))
    .mul(closeTradeSize)
    .div(UNIT)
}
