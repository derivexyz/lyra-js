import { CollateralUpdateEvent } from '..'
import { ZERO_BN } from '../constants/bn'
import { TokenTransfer } from '../constants/queries'
import Lyra from '../lyra'
import { SettleEvent } from '../settle_event'
import { TradeEvent } from '../trade_event'
import fetchBlockForTimestamp from '../utils/fetchBlockForTimestamp'
import fetchBlockTimestamps from '../utils/fetchBlockTimestamps'
import filterNulls from '../utils/filterNulls'
import fromBigNumber from '../utils/fromBigNumber'
import groupTimeSnapshots from '../utils/groupTimeSnapshots'
import { AccountPortfolioSnapshot } from '.'
import fetchBaseBalanceHistory from './fetchBaseBalanceHistory'
import fetchPositionHistory from './fetchPositionHistory'
import fetchTokenTransfers from './fetchTokenTransfers'
import getStableBalanceHistory from './getStableBalanceHistory'

export default async function fetchPortfolioHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number
): Promise<AccountPortfolioSnapshot[]> {
  const [portfolio, positions, _startBlock, endBlock, tokenTransfers] = await Promise.all([
    lyra.account(owner).portfolioBalance(),
    lyra.positions(owner),
    fetchBlockForTimestamp(lyra, startTimestamp),
    lyra.provider.getBlock('latest'),
    fetchTokenTransfers(lyra, owner, startTimestamp),
  ])

  const latestSnapshot = {
    blockNumber: endBlock.number,
    timestamp: endBlock.timestamp,
    trades: [],
    collateralUpdates: [],
    settles: [],
    transfers: [],
    ...portfolio,
  }

  const firstTrade = positions
    .map(p => p.trades())
    .flat()
    .sort((a, b) => a.blockNumber - b.blockNumber)[0]

  if (!firstTrade) {
    // user has not traded
    return [latestSnapshot]
  }

  // limit earliest timestamp to first trade
  const startBlock =
    firstTrade.blockNumber > _startBlock.number
      ? { number: firstTrade.blockNumber, timestamp: firstTrade.timestamp }
      : _startBlock

  const [_baseHistories, positionHistory] = await Promise.all([
    Promise.all(
      portfolio.baseAccountBalances.map(base =>
        fetchBaseBalanceHistory(
          lyra,
          base.marketAddress,
          positions,
          tokenTransfers,
          portfolio.baseAccountBalances,
          startBlock,
          endBlock
        )
      )
    ),
    fetchPositionHistory(lyra, positions, startBlock, endBlock),
  ])

  const stableHistory = getStableBalanceHistory(positions, tokenTransfers, portfolio.stableAccountBalances, startBlock)
  const baseHistories = _baseHistories.filter(b => b.length)

  const combinedHistory = [...baseHistories.flat(), ...stableHistory, ...positionHistory]

  const trades = positions.map(p => p.trades()).flat()
  const tradesByBlock: Record<number, TradeEvent[]> = trades.reduce((dict, trade) => {
    return {
      ...dict,
      [trade.blockNumber]: [...(dict[trade.blockNumber] ?? []), trade],
    }
  }, {} as Record<number, TradeEvent[]>)

  const collateralUpdates = positions.map(p => p.collateralUpdates()).flat()
  const collateralUpdatesByBlock: Record<number, CollateralUpdateEvent[]> = collateralUpdates.reduce(
    (dict, collateralUpdate) => {
      return {
        ...dict,
        [collateralUpdate.blockNumber]: [...(dict[collateralUpdate.blockNumber] ?? []), collateralUpdate],
      }
    },
    {} as Record<number, CollateralUpdateEvent[]>
  )

  const transfersByBlock: Record<number, TokenTransfer[]> = [...tokenTransfers.from, ...tokenTransfers.to].reduce(
    (dict, transfer) => {
      return {
        ...dict,
        [transfer.blockNumber]: [...(dict[transfer.blockNumber] ?? []), transfer],
      }
    },
    {} as Record<number, TokenTransfer[]>
  )

  const settles = filterNulls(positions.map(p => p.settle()))
  const settlesByBlock: Record<number, SettleEvent[]> = settles.reduce((dict, settle) => {
    return {
      ...dict,
      [settle.blockNumber]: [...(dict[settle.blockNumber] ?? []), settle],
    }
  }, {} as Record<number, SettleEvent[]>)

  const uniqueBlockNumbers = Array.from(new Set(combinedHistory.map(s => s.blockNumber))).sort()

  const timestampsByBlock = await fetchBlockTimestamps(lyra, uniqueBlockNumbers)

  const history: AccountPortfolioSnapshot[] = []

  const currBaseSnapshots = baseHistories
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(baseHistory => baseHistory.shift()!)

  let currStableSnapshot = stableHistory.shift()

  let currPositionSnapshot = positionHistory.shift()

  // merge base balance histories
  for (const blockNumber of uniqueBlockNumbers) {
    // shift current base snapshots
    for (let i = 0; i < baseHistories.length; i++) {
      const baseHistory = baseHistories[i]
      if (baseHistory[0] && blockNumber >= baseHistory[0].blockNumber) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currBaseSnapshots[i] = baseHistory.shift()!
      }
    }

    // shift current stable snapshot
    if (stableHistory[0] && blockNumber >= stableHistory[0].blockNumber) {
      currStableSnapshot = stableHistory.shift()
    }

    // shift current option snapshot
    if (positionHistory[0] && blockNumber >= positionHistory[0].blockNumber) {
      currPositionSnapshot = positionHistory.shift()
    }

    const baseAccountValue = fromBigNumber(currBaseSnapshots.reduce((sum, base) => sum.add(base.accountValue), ZERO_BN))
    const baseCollateralValue = fromBigNumber(
      currBaseSnapshots.reduce((sum, base) => sum.add(base.collateralValue), ZERO_BN)
    )

    const stableAccountValue = currStableSnapshot?.accountBalance ?? 0
    const stableCollateralValue = currStableSnapshot?.collateralBalance ?? 0

    const longOptionValue = fromBigNumber(currPositionSnapshot?.longOptionValue ?? ZERO_BN)
    const shortOptionValue = fromBigNumber(currPositionSnapshot?.shortOptionValue ?? ZERO_BN)

    const totalValue =
      baseAccountValue +
      baseCollateralValue +
      stableAccountValue +
      stableCollateralValue +
      longOptionValue +
      shortOptionValue

    const baseAccountBalances = [...currBaseSnapshots]
    const stableAccountBalances = currStableSnapshot?.accountBalances ? [...currStableSnapshot.accountBalances] : []

    const snapshot = {
      blockNumber,
      timestamp: timestampsByBlock[blockNumber],
      longOptionValue,
      shortOptionValue,
      baseAccountValue,
      baseCollateralValue,
      stableCollateralValue,
      stableAccountValue,
      totalValue,
      baseAccountBalances,
      stableAccountBalances,
      trades: tradesByBlock[blockNumber] ?? [],
      collateralUpdates: collateralUpdatesByBlock[blockNumber] ?? [],
      settles: settlesByBlock[blockNumber] ?? [],
      transfers: transfersByBlock[blockNumber] ?? [],
    }

    // skip blocks that haven't synced to subgraph yet
    if (snapshot.timestamp) {
      history.push(snapshot)
    }
  }

  // append latest
  history.push(latestSnapshot)

  return groupTimeSnapshots(history, endBlock.timestamp)
}
