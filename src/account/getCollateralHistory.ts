import { BigNumber } from 'ethers'

import { CollateralUpdateEvent } from '..'
import { PartialBlock } from '../constants/blocks'
import { ZERO_BN } from '../constants/bn'
import { Position } from '../position'
import { SettleEvent } from '../settle_event'
import filterNulls from '../utils/filterNulls'

export type CollateralSnapshot = {
  balance: BigNumber
  collateralUpdates: CollateralUpdateEvent[]
  settles: SettleEvent[]
  blockNumber: number
  timestamp: number
}

export default function getCollateralHistory(positions: Position[], startBlock: PartialBlock): CollateralSnapshot[] {
  const collateralUpdates = positions.flatMap(p => p.collateralUpdates())
  const settles = filterNulls(positions.map(p => p.settle()))

  // merge collat update and settle events
  const events = [
    ...collateralUpdates.map(c => ({
      blockNumber: c.blockNumber,
      timestamp: c.timestamp,
      positionId: c.positionId,
      amount: c.amount,
    })),
    ...settles.map(s => ({
      blockNumber: s.blockNumber,
      timestamp: s.timestamp,
      positionId: s.positionId,
      amount: ZERO_BN,
    })),
  ].sort((a, b) => a.blockNumber - b.blockNumber)

  const collatUpdatesByBlock: Record<number, CollateralUpdateEvent[]> = collateralUpdates.reduce(
    (dict, collatUpdate) => ({
      ...dict,
      [collatUpdate.blockNumber]: [...(dict[collatUpdate.blockNumber] ?? []), collatUpdate],
    }),
    {} as Record<number, CollateralUpdateEvent[]>
  )

  const settlesByBlock: Record<number, SettleEvent[]> = settles.reduce(
    (dict, settle) => ({ ...dict, [settle.blockNumber]: [...(dict[settle.blockNumber] ?? []), settle] }),
    {} as Record<number, SettleEvent[]>
  )

  const timestampByBlock: Record<number, number> = events.reduce(
    (dict, s) => ({ ...dict, [s.blockNumber]: s.timestamp }),
    {}
  )

  // group by block and position
  const eventByBlockByPosition: Record<number, Record<number, BigNumber>> = events.reduce((dict, update, idx) => {
    const prevDict: Record<number, BigNumber> = idx > 0 ? dict[events[idx - 1].blockNumber] : {}
    dict[update.blockNumber] = { ...prevDict, ...dict[update.blockNumber] } // overwrite update balance
    dict[update.blockNumber][update.positionId] = update.amount
    return dict
  }, {} as Record<number, Record<number, BigNumber>>)

  // group by block
  const eventByBlockNumber: Record<number, BigNumber> = Object.entries(eventByBlockByPosition).reduce(
    (dict, [blockNumber, collateralByPosition]) => ({
      ...dict,
      [blockNumber]: Object.values(collateralByPosition).reduce((sum, collateral) => sum.add(collateral), ZERO_BN),
    }),
    {}
  )

  const history = Object.entries(eventByBlockNumber).map(([blockNumber, balance]) => ({
    balance,
    blockNumber: parseInt(blockNumber),
    timestamp: timestampByBlock[parseInt(blockNumber)],
    collateralUpdates: collatUpdatesByBlock[parseInt(blockNumber)] ?? [],
    settles: settlesByBlock[parseInt(blockNumber)] ?? [],
  }))

  if (!history.length) {
    return []
  }

  // get last balance before start block cutoff, or default to 0 balance
  const startBalance = [...history].reverse().find(s => s.blockNumber <= startBlock.number)?.balance ?? ZERO_BN

  return [
    {
      blockNumber: startBlock.number,
      timestamp: startBlock.timestamp,
      balance: startBalance,
      collateralUpdates: [],
      settles: [],
    },
    ...history.filter(s => s.blockNumber >= startBlock.number),
  ]
}
