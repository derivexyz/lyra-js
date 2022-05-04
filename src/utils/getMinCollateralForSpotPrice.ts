import { BigNumber } from '@ethersproject/bignumber'

import { MAX_BN, UNIT, ZERO_BN } from '../constants/bn'
import { OptionGreekCache } from '../contracts/typechain/OptionMarketViewer'
import { Market } from '../market'
import { Option } from '../option'
import { getBlackScholesPrice } from './blackScholes'
import fromBigNumber from './fromBigNumber'
import getTimeToExpiryAnnualized from './getTimeToExpiryAnnualized'
import toBigNumber from './toBigNumber'

const getShockVol = (
  minCollatParams: OptionGreekCache.MinCollateralParametersStructOutput,
  _timeToExpiry: number,
  isMaxMinCollateral?: boolean
) => {
  if (isMaxMinCollateral) {
    // Default to largest shock vol
    return minCollatParams.shockVolA
  }
  const timeToExpiry = BigNumber.from(_timeToExpiry)
  if (timeToExpiry.lte(minCollatParams.shockVolPointA)) {
    return minCollatParams.shockVolA
  }
  if (timeToExpiry.gte(minCollatParams.shockVolPointB)) {
    return minCollatParams.shockVolB
  }

  const shockVolDiff = minCollatParams.shockVolA.sub(minCollatParams.shockVolB)
  const timeToMaturityShockVolPointA = timeToExpiry.sub(minCollatParams.shockVolPointA)
  return minCollatParams.shockVolA.sub(
    shockVolDiff
      .mul(timeToMaturityShockVolPointA)
      .div(minCollatParams.shockVolPointB.sub(minCollatParams.shockVolPointA))
  )
}

export const getMinStaticCollateral = (market: Market, isBaseCollateral?: boolean) => {
  const { minCollatParams } = market.__marketData.marketParameters
  return isBaseCollateral ? minCollatParams.minStaticBaseCollateral : minCollatParams.minStaticQuoteCollateral
}

export default function getMinCollateralForSpotPrice(
  option: Option,
  size: BigNumber,
  spotPrice: BigNumber,
  isBaseCollateral?: boolean,
  // Use largest min collateral that will ever be required (informs liquidation price)
  isMaxMinCollateral?: boolean
): BigNumber {
  const timeToExpiry = option.board().timeToExpiry
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())
  if (timeToExpiryAnnualized === 0) {
    return ZERO_BN
  }
  const minCollatParams = option.market().__marketData.marketParameters.minCollatParams
  const shockSpotPrice = option.isCall
    ? spotPrice.mul(minCollatParams.callSpotPriceShock).div(UNIT)
    : spotPrice.mul(minCollatParams.putSpotPriceShock).div(UNIT)
  const rate = option.market().__marketData.marketParameters.greekCacheParams.rateAndCarry
  const shockOptionPrice = toBigNumber(
    getBlackScholesPrice(
      timeToExpiryAnnualized,
      fromBigNumber(getShockVol(minCollatParams, timeToExpiry, isMaxMinCollateral)),
      fromBigNumber(shockSpotPrice),
      fromBigNumber(option.strike().strikePrice),
      fromBigNumber(rate),
      option.isCall
    )
  )

  let fullCollat: BigNumber
  let volCollat: BigNumber
  const staticCollat = getMinStaticCollateral(option.market(), isBaseCollateral)
  if (option.isCall) {
    if (isBaseCollateral) {
      volCollat = shockOptionPrice.mul(size).div(shockSpotPrice)
      fullCollat = size
    } else {
      volCollat = shockOptionPrice.mul(size).div(UNIT)
      fullCollat = MAX_BN
    }
  } else {
    volCollat = shockOptionPrice.mul(size).div(UNIT)
    fullCollat = option.strike().strikePrice.mul(size).div(UNIT)
  }
  const maxCollat = volCollat.gt(staticCollat) ? volCollat : staticCollat
  const minCollat = maxCollat.lt(fullCollat) ? maxCollat : fullCollat
  return minCollat
}
