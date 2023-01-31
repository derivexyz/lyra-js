import { BigNumber } from '@ethersproject/bignumber'

import { MAX_BN, UNIT, ZERO_BN } from '../constants/bn'
import { Market, MarketParameters } from '../market'
import { Option } from '../option'
import { getBlackScholesPrice } from './blackScholes'
import fromBigNumber from './fromBigNumber'
import getTimeToExpiryAnnualized from './getTimeToExpiryAnnualized'
import toBigNumber from './toBigNumber'

const getShockVol = (marketParams: MarketParameters, _timeToExpiry: number, isMaxMinCollateral?: boolean) => {
  if (isMaxMinCollateral) {
    // Default to largest shock vol
    return marketParams.shockVolA
  }
  const timeToExpiry = BigNumber.from(_timeToExpiry)
  if (timeToExpiry.lte(marketParams.shockVolPointA)) {
    return marketParams.shockVolA
  }
  if (timeToExpiry.gte(marketParams.shockVolPointB)) {
    return marketParams.shockVolB
  }

  const shockVolDiff = marketParams.shockVolA.sub(marketParams.shockVolB)
  const timeToMaturityShockVolPointA = timeToExpiry.sub(marketParams.shockVolPointA)
  return marketParams.shockVolA.sub(
    shockVolDiff.mul(timeToMaturityShockVolPointA).div(marketParams.shockVolPointB.sub(marketParams.shockVolPointA))
  )
}

export const getMinStaticCollateral = (market: Market, isBaseCollateral?: boolean) => {
  return isBaseCollateral ? market.params.minStaticBaseCollateral : market.params.minStaticQuoteCollateral
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
  const market = option.market()
  const shockSpotPrice = option.isCall
    ? spotPrice.mul(market.params.callSpotPriceShock).div(UNIT)
    : spotPrice.mul(market.params.putSpotPriceShock).div(UNIT)
  const rate = option.market().params.rateAndCarry
  const shockOptionPrice = toBigNumber(
    getBlackScholesPrice(
      timeToExpiryAnnualized,
      fromBigNumber(getShockVol(market.params, timeToExpiry, isMaxMinCollateral)),
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
