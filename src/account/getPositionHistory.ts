import { BigNumber } from 'ethers'

import { PartialBlock } from '../constants/blocks'
import { ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { SettleEvent } from '../settle_event'
import { TradeEvent } from '../trade_event'

export type PositionSnapshot = {
  size: BigNumber
  blockNumber: number
  timestamp: number
  trade?: TradeEvent | null
  settle?: SettleEvent | null
}

export default function getPositionHistory(position: Position, startBlock: PartialBlock): PositionSnapshot[] {
  const trades: PositionSnapshot[] = position
    .trades()
    .map(t => {
      const size = t.newSize(position)
      return {
        blockNumber: t.blockNumber,
        timestamp: t.timestamp,
        size,
        trade: t,
      }
    })
    .sort((a, b) => a.blockNumber - b.blockNumber)

  const settle = position.settle()
  if (settle) {
    trades.push({
      blockNumber: settle.blockNumber,
      timestamp: settle.timestamp,
      size: ZERO_BN,
      settle,
    })
  }

  if (!trades.length) {
    return []
  }

  // get last trade before start block cutoff, or default to 0 size / value
  const startTrade = [...trades].reverse().find(s => s.blockNumber <= startBlock.number)

  return [
    { blockNumber: startBlock.number, timestamp: startBlock.timestamp, size: startTrade?.size ?? ZERO_BN },
    ...trades.filter(s => s.blockNumber >= startBlock.number),
  ]
}
