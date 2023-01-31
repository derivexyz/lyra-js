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
  const NAV = market.params.NAV
  if (preTradeAmmNetStdVega.abs().gte(postTradeAmmNetStdVega.abs())) {
    return {
      preTradeAmmNetStdVega,
      postTradeAmmNetStdVega,
      vegaUtil: ZERO_BN,
      volTraded,
      NAV,
      vegaUtilFee: ZERO_BN,
    }
  }
  const vegaUtil = NAV.gt(0) ? volTraded.mul(postTradeAmmNetStdVega.abs()).div(NAV) : ZERO_BN
  const _vegaUtilFee = market.params.vegaFeeCoefficient.mul(vegaUtil).div(UNIT).mul(size).div(UNIT)
  const vegaUtilFee = _vegaUtilFee.lt(0) ? ZERO_BN : _vegaUtilFee
  return {
    preTradeAmmNetStdVega,
    postTradeAmmNetStdVega,
    vegaUtil,
    volTraded,
    NAV,
    vegaUtilFee,
  }
}
