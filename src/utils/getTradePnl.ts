import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'

export default function getTradePnl(position: Position, trade: TradeEvent | Trade): BigNumber {
  if (trade.isOpen) {
    return ZERO_BN
  }

  const size = trade.size
  const isLong = trade.isLong
  const pricePerOption = trade.pricePerOption

  const averageCostPerOption =
    trade instanceof TradeEvent ? trade.prevAverageCostPerOption(position) : trade.prevAverageCostPerOption()

  // For longs, profit is fair value minus average premiums paid
  // For shorts, profit is average premiums received minus fair value
  return (isLong ? pricePerOption.sub(averageCostPerOption) : averageCostPerOption.sub(pricePerOption))
    .mul(size)
    .div(UNIT)
}
