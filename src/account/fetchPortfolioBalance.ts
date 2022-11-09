import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import fromBigNumber from '../utils/fromBigNumber'
import { AccountPortfolioBalance } from '.'

export default async function fetchPortfolioBalance(lyra: Lyra, account: string): Promise<AccountPortfolioBalance> {
  const [positions, balances, markets] = await Promise.all([
    lyra.openPositions(account),
    lyra.account(account).balances(),
    lyra.markets(),
  ])

  const longOptionValue = fromBigNumber(
    positions
      .filter(position => position.isLong)
      .map(position => position.size.mul(position.pricePerOption).div(UNIT))
      .reduce((sum, positionValue) => sum.add(positionValue), ZERO_BN)
  )

  const shortOptionValue = fromBigNumber(
    positions
      .filter(position => !position.isLong)
      .map(position => position.size.mul(position.pricePerOption).div(UNIT))
      .reduce((sum, positionValue) => sum.add(positionValue), ZERO_BN)
      .mul(-1)
  )

  const spotPriceByMarket = markets.reduce(
    (baseSpotPrices: Record<string, BigNumber>, market) => ({
      ...baseSpotPrices,
      [market.address]: market.spotPrice,
    }),
    {}
  )

  const baseCollateralValue = fromBigNumber(
    positions
      .filter(position => !position.isLong && position.collateral && position.collateral.isBase)
      .map(position => position.collateral?.amount.mul(spotPriceByMarket[position.marketAddress]).div(UNIT) ?? ZERO_BN)
      .reduce((sum, collatValue) => sum.add(collatValue), ZERO_BN)
  )
  const stableCollateralValue = fromBigNumber(
    positions
      .filter(position => !position.isLong && position.collateral && !position.collateral.isBase)
      .map(position => position.collateral?.amount ?? ZERO_BN)
      .reduce((sum, collatValue) => sum.add(collatValue), ZERO_BN)
  )

  const baseAccountValue = fromBigNumber(
    balances.bases.reduce((sum, balance) => {
      const spotPrice = spotPriceByMarket[balance.marketAddress]
      const value = balance.balance.mul(spotPrice).div(UNIT)
      return sum.add(value)
    }, ZERO_BN)
  )

  const stableAccountValue = balances.stables.reduce((total, balance) => {
    return total + fromBigNumber(balance.balance, balance.decimals)
  }, 0)

  const totalValue =
    longOptionValue +
    shortOptionValue +
    stableAccountValue +
    stableCollateralValue +
    baseAccountValue +
    baseCollateralValue

  return {
    longOptionValue,
    shortOptionValue,
    baseCollateralValue,
    baseAccountValue,
    stableCollateralValue,
    stableAccountValue,
    totalValue,
    positions,
    stableAccountBalances: balances.stables,
    baseAccountBalances: balances.bases.map(b => ({
      ...b,
      spotPrice: spotPriceByMarket[b.marketAddress],
      value: spotPriceByMarket[b.marketAddress].mul(b.balance).div(UNIT),
    })),
  }
}
