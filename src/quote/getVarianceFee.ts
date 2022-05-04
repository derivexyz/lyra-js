import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import Option from '../option'
import { getVega } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'
import { QuoteVarianceFeeComponents } from '.'

export default function getVarianceFee(
  option: Option,
  volTraded: BigNumber,
  newSkew: BigNumber,
  newBaseIv: BigNumber,
  size: BigNumber,
  isForceClose: boolean
): QuoteVarianceFeeComponents {
  const { varianceFeeParams } = option.market().__marketData.marketParameters
  const coefficient = isForceClose
    ? varianceFeeParams.forceCloseVarianceFeeCoefficient
    : varianceFeeParams.defaultVarianceFeeCoefficient
  const ivVariance = option.board().__boardData.forceCloseGwavIV.sub(newBaseIv).abs()
  const rate = option.market().__marketData.marketParameters.greekCacheParams.rateAndCarry
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())
  const vega = toBigNumber(
    getVega(
      timeToExpiryAnnualized,
      fromBigNumber(volTraded),
      fromBigNumber(option.market().spotPrice),
      fromBigNumber(option.strike().strikePrice),
      fromBigNumber(rate)
    ) * 100
  )
  if (coefficient.isZero()) {
    return {
      varianceFeeCoefficient: ZERO_BN,
      vega,
      vegaCoefficient: ZERO_BN,
      skew: newSkew,
      skewCoefficient: ZERO_BN,
      ivVariance,
      ivVarianceCoefficient: ZERO_BN,
      varianceFee: ZERO_BN,
    }
  }
  const vegaCoefficient = varianceFeeParams.minimumStaticVega.add(vega.mul(varianceFeeParams.vegaCoefficient).div(UNIT))
  const skewDiff = newSkew.sub(varianceFeeParams.referenceSkew).abs()
  const skewCoefficient = varianceFeeParams.minimumStaticSkewAdjustment.add(
    skewDiff.mul(varianceFeeParams.skewAdjustmentCoefficient).div(UNIT)
  )
  const ivVarianceCoefficient = varianceFeeParams.minimumStaticIvVariance.add(
    ivVariance.mul(varianceFeeParams.ivVarianceCoefficient).div(UNIT)
  )
  const varianceFee = coefficient
    .mul(vegaCoefficient)
    .div(UNIT)
    .mul(skewCoefficient)
    .div(UNIT)
    .mul(ivVarianceCoefficient)
    .div(UNIT)
    .mul(size)
    .div(UNIT)
  return {
    varianceFeeCoefficient: coefficient,
    vega,
    vegaCoefficient,
    skew: newSkew,
    skewCoefficient,
    ivVariance,
    ivVarianceCoefficient,
    varianceFee,
  }
}
