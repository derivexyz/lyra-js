import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import Option from '../option'
import { getBlackScholesPrice } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'

export default function getPrice(
  option: Option,
  newBaseIv: BigNumber,
  newSkew: BigNumber
): {
  price: BigNumber
  volTraded: BigNumber
} {
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())

  const marketParams = option.market().__marketData.marketParameters
  const rate = marketParams.greekCacheParams.rateAndCarry

  const newVol = newBaseIv.mul(newSkew).div(UNIT)

  const spotPrice = option.market().spotPrice
  const strikePrice = option.strike().strikePrice
  const price = toBigNumber(
    getBlackScholesPrice(
      timeToExpiryAnnualized,
      fromBigNumber(newVol),
      fromBigNumber(spotPrice),
      fromBigNumber(strikePrice),
      fromBigNumber(rate),
      option.isCall
    )
  )
  return {
    price,
    volTraded: newVol,
  }
}
