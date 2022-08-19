import { AccountPortfolioHistory } from '..'
import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import fetchBalanceHistory from '../utils/fetchBalanceHistory'
import fetchLongOptionHistory from '../utils/fetchLongOptionHistory'
import fetchShortOptionHistory from '../utils/fetchShortOptionHistory'
import fromBigNumber from '../utils/fromBigNumber'

const FIFTEEN_MINUTE_INTERVAL_IN_SECONDS = 60 * 15

export default async function getPortfolioHistory(
  lyra: Lyra,
  account: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<AccountPortfolioHistory> {
  const [portfolioBalance, balanceHistory, longOptionHistory, shortOptionHistory] = await Promise.all([
    lyra.account(account).portfolioBalance(),
    fetchBalanceHistory(lyra, account, startTimestamp, endTimestamp),
    fetchLongOptionHistory(lyra, account, startTimestamp, endTimestamp),
    fetchShortOptionHistory(lyra, account, startTimestamp, endTimestamp),
  ])

  const history: AccountPortfolioHistory = []
  balanceHistory.sort((a, b) => a.timestamp - b.timestamp)
  longOptionHistory.sort((a, b) => a.timestamp - b.timestamp)
  shortOptionHistory.sort((a, b) => a.timestamp - b.timestamp)
  let currLongOption = longOptionHistory[0]
  let currShortOption = shortOptionHistory[0]
  let currBalance = balanceHistory[0]
  let nextLongOption = longOptionHistory[1]
  let nextShortOption = shortOptionHistory[1]
  let nextBalance = balanceHistory[1]
  for (let t = startTimestamp; t < endTimestamp; t += FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) {
    let hasChanged = false
    if (currLongOption && t > nextLongOption?.timestamp) {
      currLongOption = nextLongOption
      nextLongOption =
        longOptionHistory.find(h => h.timestamp >= t + FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? currLongOption
      hasChanged = true
    }
    if (currShortOption && t > nextShortOption?.timestamp) {
      currShortOption = nextShortOption
      nextShortOption =
        shortOptionHistory.find(h => h.timestamp >= t + FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? currShortOption
      hasChanged = true
    }
    if (currBalance && t > nextBalance?.timestamp) {
      currBalance = nextBalance
      nextBalance = balanceHistory.find(h => h.timestamp >= t + FIFTEEN_MINUTE_INTERVAL_IN_SECONDS) ?? currBalance
      hasChanged = true
    }
    if (hasChanged) {
      const currLongOptionValue = fromBigNumber(currLongOption?.optionValue ?? ZERO_BN)
      const currShortOptionValue = fromBigNumber(currShortOption?.optionValue ?? ZERO_BN)
      const currCollateralValue = fromBigNumber(currShortOption?.collateralValue ?? ZERO_BN)
      const currBalanceValue = fromBigNumber(currBalance?.balance ?? ZERO_BN)
      history.push({
        timestamp: t,
        longOptionValue: currLongOptionValue,
        shortOptionValue: currShortOptionValue,
        collateralValue: currCollateralValue,
        balance: currBalanceValue,
        total: currBalanceValue + currLongOptionValue + currCollateralValue - currShortOptionValue,
      })
    }
  }
  history.push({
    timestamp: endTimestamp,
    longOptionValue: portfolioBalance.longOptionValue,
    shortOptionValue: portfolioBalance.shortOptionValue,
    collateralValue: portfolioBalance.collateralValue,
    balance: portfolioBalance.balance,
    total:
      portfolioBalance.balance +
      portfolioBalance.longOptionValue +
      portfolioBalance.collateralValue -
      portfolioBalance.shortOptionValue,
  })
  return history.sort((a, b) => a.timestamp - b.timestamp)
}
