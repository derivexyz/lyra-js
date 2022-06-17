import { AccountPortfolioHistory } from '..'
import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import fetchBalanceHistory from '../utils/fetchBalanceHistory'
import fetchLongOptionHistory from '../utils/fetchLongOptionHistory'
import fetchShortOptionHistory from '../utils/fetchShortOptionHistory'
import fromBigNumber from '../utils/fromBigNumber'

const FIFTEEN_MINUTE_INTERVAL_IN_SECONDS = 60 * 15

const getSnapshotPeriod = (startTimestamp: number, endTimestamp: number): number => {
  const oneDayAgo = Math.floor(endTimestamp - 60 * 60 * 24)
  const oneWeekAgo = Math.floor(endTimestamp - 60 * 60 * 24 * 7)
  if (startTimestamp <= oneDayAgo) {
    return 60 * 15
  } else if (startTimestamp <= oneWeekAgo) {
    return 60 * 60
  } else {
    return 60 * 60 * 24
  }
}

export default async function getPortfolioHistory(
  lyra: Lyra,
  account: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<AccountPortfolioHistory> {
  const period = getSnapshotPeriod(startTimestamp, endTimestamp)
  const [portfolioBalance, longOptionHistory, shortOptionHistory, balanceHistory] = await Promise.all([
    lyra.account(account).portfolioBalance(),
    fetchLongOptionHistory(lyra, account, startTimestamp, period),
    fetchShortOptionHistory(lyra, account, startTimestamp, period),
    fetchBalanceHistory(lyra, account, startTimestamp, period),
  ])
  longOptionHistory.sort((a, b) => b.timestamp - a.timestamp)
  shortOptionHistory.sort((a, b) => b.timestamp - a.timestamp)
  balanceHistory.sort((a, b) => b.timestamp - a.timestamp)
  const history = []
  let currLongOption = longOptionHistory[0]
  let currShortOption = shortOptionHistory[0]
  let currBalance = balanceHistory[0]
  let nextLongOption = longOptionHistory[1]
  let nextShortOption = shortOptionHistory[1]
  let nextBalance = balanceHistory[1]
  for (let t = endTimestamp; t > startTimestamp; t -= FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) {
    let hasChanged = false
    if (currLongOption && t < nextLongOption?.timestamp) {
      currLongOption = nextLongOption
      nextLongOption =
        longOptionHistory.find(h => h.timestamp < t - FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? longOptionHistory[0]
      hasChanged = true
    }
    if (currShortOption && t < nextShortOption?.timestamp) {
      currShortOption = nextShortOption
      nextShortOption =
        shortOptionHistory.find(h => h.timestamp < t - FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? shortOptionHistory[0]
      hasChanged = true
    }
    if (currBalance && t < nextBalance?.timestamp) {
      currBalance = nextBalance
      nextBalance = balanceHistory.find(h => h.timestamp < t - FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? balanceHistory[0]
      hasChanged = true
    }
    if (hasChanged) {
      const currLongOptionValue = fromBigNumber(currLongOption?.optionValue ?? ZERO_BN)
      const currShortOptionValue = fromBigNumber(currShortOption?.optionValue ?? ZERO_BN)
      const currBalanceValue = fromBigNumber(currBalance?.balance ?? ZERO_BN)
      history.push({
        timestamp: t,
        longOptionValue: currLongOptionValue,
        shortOptionValue: currShortOptionValue,
        balance: currBalanceValue,
        total: currBalanceValue + currLongOptionValue - currShortOptionValue,
      })
    }
  }
  history.push({
    timestamp: endTimestamp,
    longOptionValue: portfolioBalance.longOptionValue,
    shortOptionValue: portfolioBalance.shortOptionValue,
    balance: portfolioBalance.balance,
    total: portfolioBalance.balance + portfolioBalance.longOptionValue - portfolioBalance.shortOptionValue,
  })
  return history.sort((a, b) => a.timestamp - b.timestamp)
}
