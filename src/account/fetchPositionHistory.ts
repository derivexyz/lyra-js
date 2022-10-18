import { AccountPositionSnapshot } from '..'
import { PartialBlock } from '../constants/blocks'
import { UNIT, ZERO_BN } from '../constants/bn'
import { SnapshotPeriod } from '../constants/queries'
import Lyra from '../lyra'
import { OptionPriceHistory } from '../option'
import { Position } from '../position'
import fetchPositionPriceHistoryByIDs from '../utils/fetchPositionPriceHistoryByIDs'
import filterNulls from '../utils/filterNulls'
import getPositionHistory from './getPositionHistory'

export default async function fetchPositionHistory(
  lyra: Lyra,
  positions: Position[],
  startTimestamp: number,
  endBlock: PartialBlock
): Promise<AccountPositionSnapshot[]> {
  const priceHistoryByIds = await fetchPositionPriceHistoryByIDs(lyra, positions, {
    startTimestamp: startTimestamp,
    endTimestamp: endBlock.timestamp,
    period: SnapshotPeriod.OneDay,
  })

  const positionHistories = positions
    .map(position => {
      const priceHistory: OptionPriceHistory[] = priceHistoryByIds[position.id] ?? []
      const tradeHistory = getPositionHistory(position, startTimestamp)

      const combinedHistory = [...priceHistory, ...tradeHistory]

      const timestampByBlock: Record<number, number> = combinedHistory.reduce(
        (dict, s) => ({ ...dict, [s.blockNumber]: s.timestamp }),
        {}
      )

      const uniqueBlockNumbers = Array.from(new Set(combinedHistory.map(s => s.blockNumber))).sort()

      let currPrice = priceHistory.shift()
      let currTrade = tradeHistory.shift()

      return uniqueBlockNumbers.map(blockNumber => {
        if (priceHistory[0] && blockNumber >= priceHistory[0].blockNumber) {
          currPrice = priceHistory.shift()
        }
        if (tradeHistory[0] && blockNumber >= tradeHistory[0].blockNumber) {
          currTrade = tradeHistory.shift()
        }

        const optionPrice = (currPrice?.optionPrice ?? ZERO_BN).mul(position.isLong ? 1 : -1)
        const size = currTrade?.size ?? ZERO_BN
        const value = size.mul(optionPrice).div(UNIT)

        const trade = blockNumber === currTrade?.blockNumber ? currTrade?.trade : null
        const settle = blockNumber === currTrade?.blockNumber ? currTrade?.settle : null

        return {
          positionId: position.id,
          blockNumber,
          timestamp: timestampByBlock[blockNumber],
          size,
          value,
          trade,
          settle,
        }
      })
    })
    .filter(h => h.length)

  const combinedHistory = positionHistories.flat()

  const timestampByBlock: Record<number, number> = combinedHistory.reduce(
    (dict, transfer) => ({ ...dict, [transfer.blockNumber]: transfer.timestamp }),
    {}
  )

  const uniqueBlockNumbers = Array.from(new Set(combinedHistory.map(s => s.blockNumber))).sort()

  const currPositions = positionHistories
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(baseHistory => baseHistory.shift()!)

  // merge base balance histories
  return uniqueBlockNumbers.map(blockNumber => {
    // shift current base snapshots
    for (let i = 0; i < positionHistories.length; i++) {
      const positionHistory = positionHistories[i]
      if (positionHistory[0] && blockNumber >= positionHistory[0].blockNumber) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currPositions[i] = positionHistory.shift()!
      }
    }

    const longOptionValue = currPositions
      .filter(({ value }) => value.gt(0))
      .reduce((sum, { value }) => sum.add(value), ZERO_BN)

    const shortOptionValue = currPositions
      .filter(({ value }) => value.lt(0))
      .reduce((sum, { value }) => sum.add(value), ZERO_BN)

    const trades = filterNulls(currPositions.map(({ trade }) => trade))
    const settles = filterNulls(currPositions.map(({ settle }) => settle))

    return {
      blockNumber,
      timestamp: timestampByBlock[blockNumber],
      longOptionValue,
      shortOptionValue,
      trades,
      collateralUpdates: [],
      settles,
    }
  })
}
