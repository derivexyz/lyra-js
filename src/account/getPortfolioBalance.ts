import { BigNumber } from 'ethers'

import { AccountPortfolioBalance } from '../account'
import Lyra from '../lyra'
import fromBigNumber from '../utils/fromBigNumber'

export default async function getPortfolioBalance(lyra: Lyra, account: string): Promise<AccountPortfolioBalance> {
  const [positions, balances, markets] = await Promise.all([
    lyra.openPositions(account),
    lyra.account(account).balances(),
    lyra.markets(),
  ])
  const longOptionValue = positions
    .filter(position => position.isLong)
    .map(position => {
      const size = fromBigNumber(position.size)
      const pricePerOption = fromBigNumber(position.pricePerOption)
      const value = size * pricePerOption
      return value
    })
    .reduce((total: number, position: number) => {
      return total + position
    }, 0)

  const shortOptionValue = positions
    .filter(position => !position.isLong)
    .map(position => {
      const size = fromBigNumber(position.size)
      const pricePerOption = fromBigNumber(position.pricePerOption)
      const value = size * pricePerOption
      let collateralValue = 0
      const collateral = position.collateral
      if (collateral) {
        collateralValue = fromBigNumber(collateral.amount)
      }
      return value + collateralValue
    })
    .reduce((total: number, position: number) => {
      return total + position
    }, 0)

  const stableBalances = balances.stables.reduce((total, balance) => {
    return total + fromBigNumber(balance.balance, balance.decimals)
  }, 0)

  const baseSpotPrices = markets.reduce((baseSpotPrices: Record<string, BigNumber>, market) => {
    baseSpotPrices[market.baseToken.address] = market.spotPrice
    return baseSpotPrices
  }, {})

  const baseBalances = balances.bases.reduce((total, balance) => {
    const spotPrice = baseSpotPrices[balance.address]
    return total + fromBigNumber(balance.balance, balance.decimals) * fromBigNumber(spotPrice)
  }, 0)

  return {
    longOptionValue,
    shortOptionValue,
    balance: stableBalances + baseBalances,
    total: stableBalances + baseBalances + longOptionValue - shortOptionValue,
  }
}
