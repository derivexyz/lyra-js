import { BigNumber } from '@ethersproject/bignumber'

import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import { getBlackScholesPrice, getDelta } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'
import getPrice from './getPrice'

const getParity = (option: Option, spotPrice: BigNumber): BigNumber => {
  const diff = !option.isCall ? option.strike().strikePrice.sub(spotPrice) : spotPrice.sub(option.strike().strikePrice)
  return diff.gt(0) ? diff : ZERO_BN
}

export default function getForceClosePrice(
  option: Option,
  isBuy: boolean,
  spotPrice: BigNumber,
  newBaseIv: BigNumber,
  newSkew: BigNumber
): {
  volTraded: BigNumber
  price: BigNumber
} {
  const newVol = newBaseIv.mul(newSkew).div(UNIT)

  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())

  const market = option.market()
  const rate = market.params.rateAndCarry

  const isPostCutoff = option.block.timestamp + market.params.tradingCutoff > option.board().expiryTimestamp

  const forceCloseGwavIv = option.board().params.forceCloseGwavIv
  const forceCloseSkew = option.strike().params.forceCloseSkew

  const strikePrice = option.strike().strikePrice

  const callDelta = toBigNumber(
    getDelta(
      timeToExpiryAnnualized,
      fromBigNumber(newVol),
      fromBigNumber(spotPrice),
      fromBigNumber(strikePrice),
      fromBigNumber(rate),
      true
    )
  )
  const minForceCloseDelta = market.params.minForceCloseDelta
  const isDeltaOutOfRange = callDelta.lte(minForceCloseDelta) || callDelta.gte(ONE_BN.sub(minForceCloseDelta))

  if (isPostCutoff || isDeltaOutOfRange) {
    let forceCloseVol = forceCloseGwavIv.mul(forceCloseSkew).div(UNIT)
    if (isBuy) {
      forceCloseVol = forceCloseVol.gt(newVol) ? forceCloseVol : newVol
      forceCloseVol = isPostCutoff
        ? forceCloseVol.mul(market.params.shortPostCutoffVolShock).div(UNIT)
        : forceCloseVol.mul(market.params.shortVolShock).div(UNIT)
    } else {
      forceCloseVol = forceCloseVol.lt(newVol) ? forceCloseVol : newVol
      forceCloseVol = isPostCutoff
        ? forceCloseVol.mul(market.params.longPostCutoffVolShock).div(UNIT)
        : forceCloseVol.mul(market.params.longVolShock).div(UNIT)
    }

    let price = toBigNumber(
      getBlackScholesPrice(
        timeToExpiryAnnualized,
        fromBigNumber(forceCloseVol),
        fromBigNumber(spotPrice),
        fromBigNumber(strikePrice),
        fromBigNumber(rate),
        option.isCall
      )
    )

    if (isBuy) {
      const parity = getParity(option, spotPrice)
      const factor = spotPrice.mul(market.params.shortSpotMin).div(UNIT)
      const minPrice = parity.add(factor)
      price = price.gt(minPrice) ? price : minPrice
    }

    return {
      volTraded: forceCloseVol,
      price,
    }
  } else {
    // Default to black scholes pricing
    return getPrice(option, spotPrice, newBaseIv, newSkew)
  }
}
