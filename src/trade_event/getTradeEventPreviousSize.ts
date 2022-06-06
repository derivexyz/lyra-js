import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import getPositionPreviousTrades from '../utils/getPositionPreviousTrades'
import { TradeEvent } from '.'

export default function getTradeEventPreviousSize(position: Position, trade: TradeEvent): BigNumber {
  const trades = getPositionPreviousTrades(position, trade)
  const prevSize = trades.reduce((size, trade) => (trade.isOpen ? size.add(trade.size) : size.sub(trade.size)), ZERO_BN)
  return prevSize
}
