import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import TradeEvent from '../trade_event'

export default function getPositionAverageCost(trades: TradeEvent[]): BigNumber {
  if (trades.length === 0) {
    return ZERO_BN
  }
  if (trades.length === 1) {
    const trade = trades[0]
    return trade.pricePerOption
  }
  let currOpenSize = ZERO_BN
  let averageCostPerOption = ZERO_BN
  for (const trade of trades) {
    const prevOpenSize = currOpenSize
    const { size, premium, isOpen } = trade
    // Add or remove amount from position
    currOpenSize = isOpen ? currOpenSize.add(size) : currOpenSize.sub(size)
    // Update rolling average if adding to position
    if (isOpen && currOpenSize.gt(0)) {
      averageCostPerOption = averageCostPerOption.mul(prevOpenSize).div(UNIT).add(premium).mul(UNIT).div(currOpenSize)
    }
  }
  return averageCostPerOption
}
