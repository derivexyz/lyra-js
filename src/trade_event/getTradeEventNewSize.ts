import { BigNumber } from 'ethers'

import { Position } from '../position'
import { TradeEvent } from '.'
import getTradeEventPreviousSize from './getTradeEventPreviousSize'

export default function getTradeEventNewSize(position: Position, trade: TradeEvent): BigNumber {
  const prevSize = getTradeEventPreviousSize(position, trade)
  const newSize = trade.isOpen ? prevSize.add(trade.size) : prevSize.sub(trade.size)
  return newSize
}
