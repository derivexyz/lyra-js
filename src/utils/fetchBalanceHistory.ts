import { BigNumber } from 'ethers'

import { AccountBalanceHistory } from '../account'
import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import { MarketSpotPrice } from '../market'
import fetchEarliestBlockFromTimestamp from './fetchEarliestBlockFromTimestamp'
import fetchSpotPriceHistory from './fetchSpotPriceHistory'
import fetchTimestampsFromBlocks, { BlockTimestamps } from './fetchTimestampsFromBlocks'
import fromBigNumber from './fromBigNumber'
import getERC20Contract from './getERC20Contract'
import getSnapshotPeriod from './getSnapshotPeriod'
import toBigNumber from './toBigNumber'

type BalanceHistoryEvent = {
  blockNumber: number
  balance: number
}

type BalanceHistory = BalanceHistoryEvent[]

const getClosestSpotPrice = (spotPrices: MarketSpotPrice[], currentTimestamp: number): BigNumber => {
  return spotPrices.find(spotPrice => spotPrice.timestamp >= currentTimestamp)?.spotPrice ?? spotPrices[0].spotPrice
}

const getClosestBlockNumber = (blockTimestamps: BlockTimestamps[], currentTimestamp: number): number => {
  return (
    blockTimestamps.find(blockTimestamp => blockTimestamp.timestamp >= currentTimestamp)?.number ??
    blockTimestamps[0].number
  )
}

const getClosestBalance = (balances: BalanceHistory, currentBlockNumber: number): number => {
  return balances.find(balance => balance.blockNumber === currentBlockNumber)?.balance ?? balances[0].balance
}

const getBalanceHistory = async (
  lyra: Lyra,
  owner: string,
  tokenAddress: string,
  tokenDecimals: number,
  fromBlock: number
) => {
  const contract = getERC20Contract(lyra.provider, tokenAddress)
  const transferFromFilter = contract.filters.Transfer(owner, null, null)
  const transferToFilter = contract.filters.Transfer(null, owner, null)
  const [transferFromEvents, transferToEvents] = await Promise.all([
    contract.queryFilter(transferFromFilter, fromBlock),
    contract.queryFilter(transferToFilter, fromBlock),
  ])
  transferFromEvents.sort((a, b) => b.blockNumber - a.blockNumber)
  transferToEvents.sort((a, b) => b.blockNumber - a.blockNumber)

  let transferFromPointer = 0
  let transferToPointer = 0
  let balance = fromBigNumber(await getERC20Contract(lyra.provider, tokenAddress).balanceOf(owner), tokenDecimals)
  const balanceHistory: BalanceHistory = []
  balanceHistory.push({
    blockNumber: lyra.provider.blockNumber,
    balance,
  })
  while (transferFromPointer < transferFromEvents.length || transferToPointer < transferToEvents.length) {
    const transferFromEvent = transferFromEvents[transferFromPointer]
    const transferToEvent = transferToEvents[transferToPointer]
    const transferFromBlockNumber = transferFromEvent?.blockNumber ?? -Infinity
    const transferToBlockNumber = transferToEvent?.blockNumber ?? -Infinity
    if (transferFromBlockNumber < transferToBlockNumber) {
      balance -= fromBigNumber(transferToEvent?.args.value ?? ZERO_BN, tokenDecimals)
      balanceHistory.push({
        blockNumber: transferToBlockNumber,
        balance,
      })
      transferToPointer++
    } else {
      balance += fromBigNumber(transferFromEvent?.args.value ?? ZERO_BN, tokenDecimals)
      balanceHistory.push({
        blockNumber: transferFromBlockNumber,
        balance,
      })
      transferFromPointer++
    }
  }
  return balanceHistory
}

export default async function fetchBalanceHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<AccountBalanceHistory[]> {
  const [markets, accountBalances, earliestBlock] = await Promise.all([
    lyra.markets(),
    lyra.account(owner).balances(),
    fetchEarliestBlockFromTimestamp(lyra, startTimestamp),
  ])
  const stableAssets = accountBalances.stables.map(stable => stable)
  const baseAssets = accountBalances.bases
  const fromBlock = parseInt(earliestBlock.number)
  const [stableAssetsBalanceHistory, baseAssetsBalanceHistory, baseAssetsSpotPrice] = await Promise.all([
    Promise.all(
      stableAssets.map(async stableAsset => {
        return {
          symbol: stableAsset.symbol,
          balances: await getBalanceHistory(lyra, owner, stableAsset.address, stableAsset.decimals, fromBlock),
        }
      })
    ),
    Promise.all(
      baseAssets.map(async baseAsset => {
        return {
          symbol: baseAsset.symbol,
          balances: await getBalanceHistory(lyra, owner, baseAsset.address, baseAsset.decimals, fromBlock),
        }
      })
    ),
    Promise.all(
      markets.map(async market => {
        return {
          symbol: market.baseToken.symbol,
          spotPrices: await fetchSpotPriceHistory(lyra, market, { startTimestamp, endTimestamp }),
        }
      })
    ),
  ])

  // create array of blockNumbers and fetch their corresponding timestamps
  const allBlocks = [...stableAssetsBalanceHistory, ...baseAssetsBalanceHistory]
    .map(balanceHistory => balanceHistory.balances.map(balanceEvent => balanceEvent.blockNumber))
    .flat()
  const blockTimestamps = await fetchTimestampsFromBlocks(lyra, allBlocks)

  // push current blockNumber due to subgraph delay
  let currentTimestamp = endTimestamp
  blockTimestamps.push({
    number: lyra.provider.blockNumber,
    timestamp: currentTimestamp,
  })
  blockTimestamps.sort((a, b) => b.timestamp - a.timestamp)

  const accountBalanceHistory: AccountBalanceHistory[] = []
  while (currentTimestamp > startTimestamp) {
    let currentBalance = 0
    stableAssetsBalanceHistory.forEach(stableAsset => {
      const closestBlockNumber = getClosestBlockNumber(blockTimestamps, currentTimestamp)
      const closestBalance = getClosestBalance(stableAsset.balances, closestBlockNumber)
      currentBalance += closestBalance
    })
    baseAssetsBalanceHistory.forEach(baseAsset => {
      const closestBlockNumber = getClosestBlockNumber(blockTimestamps, currentTimestamp)
      const closestBalance = getClosestBalance(baseAsset.balances, closestBlockNumber)
      const spotPrices = baseAssetsSpotPrice.find(baseAssets => baseAssets.symbol == baseAsset.symbol)?.spotPrices ?? []
      const closestSpotPrice = getClosestSpotPrice(spotPrices, currentTimestamp)
      const baseAssetBalance = closestBalance * fromBigNumber(closestSpotPrice)
      currentBalance += baseAssetBalance
    })
    accountBalanceHistory.push({
      timestamp: currentTimestamp,
      balance: toBigNumber(currentBalance),
    })
    currentTimestamp -= getSnapshotPeriod(startTimestamp, endTimestamp)
  }
  return accountBalanceHistory
}
