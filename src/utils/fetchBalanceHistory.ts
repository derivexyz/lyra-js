import { AccountBalanceHistory } from '../account'
import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import fetchBlocksFromTimestamp from './fetchBlocksFromTimestamp'
import { fetchSpotPriceHistory } from './fetchSpotPriceHistory'
import fromBigNumber from './fromBigNumber'
import getERC20Contract from './getERC20Contract'
import toBigNumber from './toBigNumber'

type BalanceHistory = {
  [key: string]: number
}

const getBalanceHistory = async (
  lyra: Lyra,
  owner: string,
  tokenAddress: string,
  tokenDecimals: number,
  blockTimestamps: Record<number, string>
) => {
  const contract = getERC20Contract(lyra.provider, tokenAddress)
  const transferFromFilter = contract.filters.Transfer(owner, null, null)
  const transferToFilter = contract.filters.Transfer(null, owner, null)
  const fromBlock = parseInt(Object.values(blockTimestamps)[0])
  const [transferFromEvents, transferToEvents] = await Promise.all([
    contract.queryFilter(transferFromFilter, fromBlock),
    contract.queryFilter(transferToFilter, fromBlock),
  ])
  transferFromEvents.sort((a, b) => b.blockNumber - a.blockNumber)
  transferToEvents.sort((a, b) => b.blockNumber - a.blockNumber)

  const blockTimestampsMap: Record<string | number, string> = {}
  for (const timestamp in blockTimestamps) {
    const blockNumber = blockTimestamps[timestamp]
    blockTimestampsMap[blockNumber] = timestamp
  }

  // balance history
  const balanceHistory: BalanceHistory = {}
  let transferFromPointer = 0
  let transferToPointer = 0
  let balance = fromBigNumber(await getERC20Contract(lyra.provider, tokenAddress).balanceOf(owner), tokenDecimals)
  const currentTimestamp = Math.floor(new Date().getTime() / 1000)
  balanceHistory[currentTimestamp] = balance
  while (transferFromPointer < transferFromEvents.length || transferToPointer < transferToEvents.length) {
    const transferFromBlock = transferFromEvents[transferFromPointer]
    const transferToBlock = transferToEvents[transferToPointer]
    const transferFromBlockNum = transferFromBlock?.blockNumber ?? -Infinity
    const transferToBlockNum = transferToBlock?.blockNumber ?? -Infinity
    if (transferFromBlockNum < transferToBlockNum) {
      balance -= fromBigNumber(transferToBlock?.args.value ?? ZERO_BN, tokenDecimals)
      const transferToTimestamp = blockTimestampsMap[transferToBlockNum] ?? 0
      balanceHistory[transferToTimestamp] = balance
      transferToPointer++
    } else if (transferFromBlockNum >= transferToBlockNum) {
      balance += fromBigNumber(transferFromBlock?.args.value ?? ZERO_BN, tokenDecimals)
      const transferFromTimestamp = blockTimestampsMap[transferFromBlockNum] ?? 0
      balanceHistory[transferFromTimestamp] = balance
      transferFromPointer++
    }
  }
  return balanceHistory
}

export default async function fetchBalanceHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  period: number
): Promise<AccountBalanceHistory[]> {
  const [markets, accountBalances, blockTimestamps] = await Promise.all([
    lyra.markets(),
    lyra.account(owner).balances(),
    fetchBlocksFromTimestamp(lyra, startTimestamp),
  ])
  const stableAssets = accountBalances.stables.map(stable => stable)
  const baseAssets = accountBalances.bases
  const [stableAssetsBalanceHistory, baseAssetsBalanceHistory, baseAssetsSpotPrice] = await Promise.all([
    Promise.all(
      stableAssets.map(async stableAsset => {
        return {
          symbol: stableAsset.symbol,
          balances: await getBalanceHistory(lyra, owner, stableAsset.address, stableAsset.decimals, blockTimestamps),
        }
      })
    ),
    Promise.all(
      baseAssets.map(async baseAsset => {
        return {
          symbol: baseAsset.symbol,
          balances: await getBalanceHistory(lyra, owner, baseAsset.address, baseAsset.decimals, blockTimestamps),
        }
      })
    ),
    Promise.all(
      markets.map(async market => {
        return {
          symbol: market.baseToken.symbol,
          spotPrices: await fetchSpotPriceHistory(lyra, market.address.toLowerCase(), startTimestamp, period),
        }
      })
    ),
  ])
  const accountBalanceHistory = []
  let currentTimestamp = Math.floor(Date.now() / 1000)
  while (currentTimestamp > startTimestamp) {
    let currentBalance = 0
    stableAssetsBalanceHistory.forEach(stableAsset => {
      const stableAssetTimestamps = Object.keys(stableAsset.balances)
        .map(timestamp => parseInt(timestamp))
        .sort((a, b) => b - a)
      const stableAssetTimestamp =
        stableAssetTimestamps.find(timestamp => timestamp >= currentTimestamp) ?? stableAssetTimestamps[0]
      const stableAssetBalance = stableAsset.balances[stableAssetTimestamp]
      currentBalance += stableAssetBalance
    })
    baseAssetsBalanceHistory.forEach(baseAsset => {
      const baseAssetTimestamps = Object.keys(baseAsset.balances)
        .map(timestamp => parseInt(timestamp))
        .sort((a, b) => b - a)
      const baseAssetTimestamp =
        baseAssetTimestamps.find(timestamp => timestamp >= currentTimestamp) ?? baseAssetTimestamps[0]
      const baseAssetSpotPrices =
        baseAssetsSpotPrice.find(baseAssets => baseAssets.symbol == baseAsset.symbol)?.spotPrices ?? []
      let baseAssetSpotPrice = ZERO_BN
      if (baseAssetSpotPrices?.length) {
        baseAssetSpotPrice =
          baseAssetSpotPrices.find(spotPrice => spotPrice.timestamp >= currentTimestamp)?.spotPrice ??
          baseAssetSpotPrices[0].spotPrice
      }
      const baseAssetBalance = baseAsset.balances[baseAssetTimestamp]
      currentBalance += baseAssetBalance * fromBigNumber(baseAssetSpotPrice)
    })
    accountBalanceHistory.push({
      timestamp: currentTimestamp,
      balance: toBigNumber(currentBalance),
    })
    currentTimestamp -= period
  }
  return accountBalanceHistory
}
