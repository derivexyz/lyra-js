import { BigNumber } from 'ethers'

import { PartialBlock } from '../constants/blocks'
import { TokenTransfer } from '../constants/queries'

export type TokenBalanceSnapshot = { balance: BigNumber; blockNumber: number; timestamp: number }

export default function getTokenBalanceHistory(
  tokenAddress: string,
  startTokenBalance: BigNumber,
  startBlock: PartialBlock,
  tokenTransfers: {
    from: TokenTransfer[]
    to: TokenTransfer[]
  }
): TokenBalanceSnapshot[] {
  // Filter by token address
  const transferFromEvents = tokenTransfers.from.filter(
    t => t.tokenAddress === tokenAddress && t.blockNumber >= startBlock.number
  )
  const transferToEvents = tokenTransfers.to.filter(
    t => t.tokenAddress === tokenAddress && t.blockNumber >= startBlock.number
  )

  if (!transferFromEvents.length && !transferToEvents.length && startTokenBalance.isZero()) {
    return []
  }

  transferFromEvents.sort((a, b) => b.blockNumber - a.blockNumber)
  transferToEvents.sort((a, b) => b.blockNumber - a.blockNumber)

  const transferEvents = (
    [
      ...transferFromEvents.map(t => ({ ...t, isFrom: true })),
      ...transferToEvents.map(t => ({ ...t, isFrom: false })),
    ] as (TokenTransfer & { isFrom: boolean })[]
  )
    .filter(t => t.amount.gt(0))
    .map(t => ({
      // subtract value in transfer-from events, add value in transfer-to events
      value: t.amount.mul(t.isFrom ? -1 : 1),
      blockNumber: t.blockNumber,
      timestamp: t.timestamp,
    }))

  const timestampByBlock: Record<number, number> = transferEvents.reduce(
    (dict, transfer) => ({ ...dict, [transfer.blockNumber]: transfer.timestamp }),
    {}
  )

  // aggregate transfer events by block number
  const transferValueByBlockNumber = transferEvents.reduce((dict, t) => {
    if (dict[t.blockNumber]) {
      dict[t.blockNumber] = dict[t.blockNumber].add(t.value)
    } else {
      dict[t.blockNumber] = t.value
    }
    return dict
  }, {} as Record<number, BigNumber>)

  const transfers = Object.entries(transferValueByBlockNumber)
    .map(([blockNumber, value]) => ({
      value,
      blockNumber: parseInt(blockNumber),
      timestamp: timestampByBlock[parseInt(blockNumber)],
    }))
    // most to least recent (start from latest balance)
    .sort((a, b) => b.blockNumber - a.blockNumber)

  let currBalance = startTokenBalance

  const history: TokenBalanceSnapshot[] = []
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i]
    history.unshift({
      balance: currBalance,
      blockNumber: transfer.blockNumber,
      timestamp: transfer.timestamp,
    })
    currBalance = currBalance.sub(transfer.value)
  }
  // append artifical event for start block
  history.unshift({
    balance: currBalance,
    blockNumber: startBlock.number,
    timestamp: startBlock.timestamp,
  })

  return history
}
