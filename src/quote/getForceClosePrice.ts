import { BigNumber } from '@ethersproject/bignumber'

import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import { getBlackScholesPrice, getDelta } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'
import getPrice from './getPrice'

const getParity = (option: Option): BigNumber => {
  const diff = !option.isCall
    ? option.strike().strikePrice.sub(option.market().spotPrice)
    : option.market().spotPrice.sub(option.strike().strikePrice)
  return diff.gt(0) ? diff : ZERO_BN
}

export default function getForceClosePrice(
  option: Option,
  isBuy: boolean,
  newBaseIv: BigNumber,
  newSkew: BigNumber
): {
  volTraded: BigNumber
  price: BigNumber
} {
  const newVol = newBaseIv.mul(newSkew).div(UNIT)

  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())

  const marketParams = option.market().__marketData.marketParameters
  const rate = marketParams.greekCacheParams.rateAndCarry
  const forceCloseParams = marketParams.forceCloseParams

  const { tradeLimitParams } = marketParams
  const isPostCutoff =
    option.board().__blockTimestamp + tradeLimitParams.tradingCutoff.toNumber() > option.board().expiryTimestamp

  const forceCloseGwavIv = option.board().__boardData.forceCloseGwavIV
  const forceCloseSkew = option.strike().__strikeData.forceCloseSkew

  const spotPrice = option.market().spotPrice
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
  const minForceCloseDelta = tradeLimitParams.minForceCloseDelta
  const isDeltaOutOfRange = callDelta.lte(minForceCloseDelta) || callDelta.gte(ONE_BN.sub(minForceCloseDelta))

  if (isPostCutoff || isDeltaOutOfRange) {
    let forceCloseVol = forceCloseGwavIv.mul(forceCloseSkew).div(UNIT)
    if (isBuy) {
      forceCloseVol = forceCloseVol.gt(newVol) ? forceCloseVol : newVol
      forceCloseVol = isPostCutoff
        ? forceCloseVol.mul(forceCloseParams.shortPostCutoffVolShock).div(UNIT)
        : forceCloseVol.mul(forceCloseParams.shortVolShock).div(UNIT)
    } else {
      forceCloseVol = forceCloseVol.lt(newVol) ? forceCloseVol : newVol
      forceCloseVol = isPostCutoff
        ? forceCloseVol.mul(forceCloseParams.longPostCutoffVolShock).div(UNIT)
        : forceCloseVol.mul(forceCloseParams.longVolShock).div(UNIT)
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
      const parity = getParity(option)
      const factor = option.market().spotPrice.mul(forceCloseParams.shortSpotMin).div(UNIT)
      const minPrice = parity.add(factor)
      price = price.gt(minPrice) ? price : minPrice
    }

    return {
      volTraded: forceCloseVol,
      price,
    }
  } else {
    // Default to black scholes pricing
    return getPrice(option, newBaseIv, newSkew)
  }
}
