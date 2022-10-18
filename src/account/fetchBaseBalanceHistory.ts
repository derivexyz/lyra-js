import { PartialBlock } from '../constants/blocks'
import { UNIT, ZERO_BN } from '../constants/bn'
import { TokenTransfer } from '../constants/queries'
import Lyra from '../lyra'
import { Position } from '../position'
import fetchSpotPriceHistory from '../utils/fetchSpotPriceHistory'
import { AccountPortfolioBalance, BaseBalanceSnapshot } from '.'
import getCollateralHistory from './getCollateralHistory'
import getTokenBalanceHistory from './getTokenBalanceHistory'

export default async function fetchBaseBalanceHistory(
  lyra: Lyra,
  marketAddress: string,
  positions: Position[],
  tokenTransfers: {
    from: TokenTransfer[]
    to: TokenTransfer[]
  },
  baseBalances: AccountPortfolioBalance['baseAccountBalances'],
  startTimestamp: number,
  endBlock: PartialBlock
): Promise<BaseBalanceSnapshot[]> {
  const base = baseBalances.find(b => b.marketAddress === marketAddress)
  if (!base) {
    throw new Error('Base collateral is missing')
  }

  // base account history
  const baseAccountHistory = getTokenBalanceHistory(base.address, base.balance, startTimestamp, tokenTransfers)

  // base collateral history
  const shortBasePositions = positions.filter(
    p => !p.isLong && p.collateral?.isBase && p.marketAddress === marketAddress
  )
  const baseCollateralHistory = getCollateralHistory(shortBasePositions, startTimestamp)

  if (!baseAccountHistory.length && !baseCollateralHistory.length) {
    return []
  }

  const spotHistory = await fetchSpotPriceHistory(lyra, marketAddress, {
    startTimestamp: startTimestamp,
    endTimestamp: endBlock.timestamp,
  })

  if (!spotHistory.length) {
    console.warn('Empty spot history')
    return []
  }

  const combinedHistory = [...baseAccountHistory, ...baseCollateralHistory, ...spotHistory]

  const uniqueBlockNumbers = Array.from(new Set(combinedHistory.map(s => s.blockNumber))).sort()

  const timestampByBlock: Record<number, number> = combinedHistory.reduce(
    (dict, transfer) => ({ ...dict, [transfer.blockNumber]: transfer.timestamp }),
    {}
  )

  let currAccountBalance = baseAccountHistory.shift()
  let currCollateralBalance = baseCollateralHistory.shift()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let currSpot = spotHistory.shift()!

  // merge base balance histories
  return uniqueBlockNumbers.map(blockNumber => {
    // shift current base snapshot
    if (baseAccountHistory[0] && blockNumber >= baseAccountHistory[0].blockNumber) {
      currAccountBalance = baseAccountHistory.shift()
    }
    // shift current base collateral snapshot
    if (baseCollateralHistory[0] && blockNumber >= baseCollateralHistory[0].blockNumber) {
      currCollateralBalance = baseCollateralHistory.shift()
    }
    // shift spot snapshot
    if (spotHistory[0] && blockNumber >= spotHistory[0].blockNumber) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      currSpot = spotHistory.shift()!
    }
    const accountBalance = currAccountBalance?.balance ?? ZERO_BN
    const collateralBalance = currCollateralBalance?.balance ?? ZERO_BN
    const balance = accountBalance.add(collateralBalance)
    const spotPrice = currSpot.spotPrice
    const accountValue = accountBalance.mul(spotPrice).div(UNIT)
    const collateralValue = collateralBalance.mul(spotPrice).div(UNIT)
    const value = accountValue.add(collateralValue)

    const collateralUpdates =
      currCollateralBalance?.blockNumber === blockNumber ? currCollateralBalance.collateralUpdates : []
    const settles = currCollateralBalance?.blockNumber === blockNumber ? currCollateralBalance.settles : []

    const snapshot = {
      blockNumber,
      balance,
      value,
      accountBalance,
      accountValue,
      collateralBalance,
      collateralValue,
      spotPrice,
      symbol: base.symbol,
      address: base.address,
      marketAddress: base.marketAddress,
      timestamp: timestampByBlock[blockNumber],
      decimals: 18,
      collateralUpdates,
      settles,
      trades: [],
    }

    return snapshot
  })
}
