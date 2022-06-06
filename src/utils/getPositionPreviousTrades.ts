import { Position } from '../position'
import { TradeEvent } from '../trade_event'

export default function getPositionPreviousTrades(position: Position, trade: TradeEvent): TradeEvent[] {
  const trades = position.trades()
  const closeTradeIndex = trades.findIndex(t => t.transactionHash === trade.transactionHash)
  if (closeTradeIndex === -1) {
    throw new Error('TradeEvent does not exist for position')
  }
  return trades.slice(0, closeTradeIndex)
}
