import { PartialBlock } from '../constants/blocks'
import { ZERO_BN } from '../constants/bn'
import { TokenTransfer } from '../constants/queries'
import { Position } from '../position'
import fromBigNumber from '../utils/fromBigNumber'
import { AccountPortfolioBalance, StableBalanceSnapshot } from '.'
import getCollateralHistory from './getCollateralHistory'
import getTokenBalanceHistory from './getTokenBalanceHistory'

export default function getStableBalanceHistory(
  positions: Position[],
  tokenTransfers: {
    from: TokenTransfer[]
    to: TokenTransfer[]
  },
  stableBalances: AccountPortfolioBalance['stableAccountBalances'],
  startBlock: PartialBlock
): StableBalanceSnapshot[] {
  const sUSDBalance = stableBalances.find(b => b.symbol === 'sUSD')
  if (!sUSDBalance) {
    throw new Error('Missing sUSD balance')
  }

  const stableAccountHistories = [sUSDBalance]
    .map(stable =>
      getTokenBalanceHistory(stable.address, stable.balance, startBlock, tokenTransfers).map(snap => ({
        ...snap,
        symbol: stable.symbol,
        address: stable.address,
        decimals: stable.decimals,
      }))
    )
    .filter(s => s.length)

  const shortStablePositions = positions.filter(p => !p.isLong && !p.collateral?.isBase)
  const stableCollateralHistory = getCollateralHistory(shortStablePositions, startBlock)

  const combinedHistory = [...stableAccountHistories.flat(), ...stableCollateralHistory]

  const timestampByBlock: Record<number, number> = combinedHistory.reduce(
    (dict, transfer) => ({ ...dict, [transfer.blockNumber]: transfer.timestamp }),
    {}
  )

  const uniqueBlockNumbers = Array.from(new Set(combinedHistory.map(s => s.blockNumber))).sort()

  const currAccountBalances = stableAccountHistories
    .filter(stableHistory => stableHistory.length)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(stableHistory => stableHistory.shift()!)

  let currCollateralBalance = stableCollateralHistory.shift()

  return uniqueBlockNumbers.map(blockNumber => {
    // shift current base snapshots
    for (let i = 0; i < stableAccountHistories.length; i++) {
      const stableHistory = stableAccountHistories[i]
      if (stableHistory[0] && blockNumber >= stableHistory[0].blockNumber) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currAccountBalances[i] = stableHistory.shift()!
      }
    }

    // shift current collateral snapshot
    if (stableCollateralHistory[0] && blockNumber >= stableCollateralHistory[0].blockNumber) {
      currCollateralBalance = stableCollateralHistory.shift()
    }

    // determine current value
    const accountBalance = currAccountBalances.reduce(
      (sum, stable) => sum + fromBigNumber(stable.balance, stable.decimals),
      0
    )
    const collateralBalance = fromBigNumber(currCollateralBalance?.balance ?? ZERO_BN)
    const balance = accountBalance + collateralBalance

    const collateralUpdates =
      currCollateralBalance?.blockNumber === blockNumber ? currCollateralBalance.collateralUpdates : []
    const settles = currCollateralBalance?.blockNumber === blockNumber ? currCollateralBalance.settles : []

    return {
      blockNumber,
      balance,
      accountBalance,
      collateralBalance,
      timestamp: timestampByBlock[blockNumber],
      accountBalances: currAccountBalances.map(b => ({
        balance: b.balance,
        symbol: b.symbol,
        address: b.address,
        decimals: b.decimals,
      })),
      collateralUpdates,
      settles,
      trades: [],
    }
  })
}
