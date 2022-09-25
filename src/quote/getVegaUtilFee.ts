import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Market } from '../market'
import { QuoteVegaUtilFeeComponents } from '.'

export default function getVegaUtilFee(
  market: Market,
  preTradeAmmNetStdVega: BigNumber,
  postTradeAmmNetStdVega: BigNumber,
  volTraded: BigNumber,
  size: BigNumber
): QuoteVegaUtilFeeComponents {
  if (preTradeAmmNetStdVega.abs().gte(postTradeAmmNetStdVega.abs())) {
    return {
      preTradeAmmNetStdVega,
      postTradeAmmNetStdVega,
      vegaUtil: ZERO_BN,
      volTraded,
      NAV: market.__marketData.liquidity.NAV,
      vegaUtilFee: ZERO_BN,
    }
  }
  const liquidity = market.__marketData.liquidity
  const pricingParams = market.__marketData.marketParameters.pricingParams
  const vegaUtil = liquidity.NAV.gt(0) ? volTraded.mul(postTradeAmmNetStdVega).div(liquidity.NAV) : ZERO_BN
  const _vegaUtilFee = pricingParams.vegaFeeCoefficient.mul(vegaUtil).div(UNIT).mul(size).div(UNIT)
  const vegaUtilFee = _vegaUtilFee.lt(0) ? ZERO_BN : _vegaUtilFee
  return {
    preTradeAmmNetStdVega,
    postTradeAmmNetStdVega,
    vegaUtil,
    volTraded,
    NAV: market.__marketData.liquidity.NAV,
    vegaUtilFee,
  }
}
