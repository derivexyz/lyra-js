import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'

export default function getAverageCostPerOption(trades: (Trade | TradeEvent)[]): BigNumber {
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
    // Add or remove size from position
    currOpenSize = isOpen ? currOpenSize.add(size) : currOpenSize.sub(size)
    if (isOpen && currOpenSize.gt(0)) {
      // Update rolling average for opens
      const totalCost = averageCostPerOption.mul(prevOpenSize).div(UNIT).add(premium)
      averageCostPerOption = totalCost.mul(UNIT).div(currOpenSize)
    }
  }
  return averageCostPerOption
}
