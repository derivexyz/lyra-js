import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'

export default function getAverageCostPerOption(trades: (Trade | TradeEvent)[]): BigNumber {
  if (trades.length === 0) {
    return ZERO_BN
  }

  let currOpenSize = trades[0].size
  let averageCostPerOption = trades[0].pricePerOption

  for (const trade of trades.slice(1)) {
    const prevOpenSize = currOpenSize
    const { size, premium, isOpen } = trade
    // Add or remove size from position
    currOpenSize = isOpen ? currOpenSize.add(size) : currOpenSize.sub(size)
    if (isOpen && currOpenSize.gt(0)) {
      const prevTotalCost = averageCostPerOption.mul(prevOpenSize).div(UNIT)
      const newTotalCost = prevTotalCost.add(premium)
      averageCostPerOption = newTotalCost.mul(UNIT).div(currOpenSize)
    }
  }

  return averageCostPerOption
}
