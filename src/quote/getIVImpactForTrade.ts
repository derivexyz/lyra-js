import { BigNumber } from 'ethers'

import { UNIT } from '../constants/bn'
import Option from '../option'

export default function getIVImpactForTrade(
  option: Option,
  baseIv: BigNumber,
  skew: BigNumber,
  size: BigNumber,
  isBuy: boolean
): {
  newSkew: BigNumber
  newBaseIv: BigNumber
} {
  const marketParams = option.market().__marketData.marketParameters
  const orderSize = size.mul(UNIT).div(marketParams.pricingParams.standardSize) // 10^18
  const orderMoveBaseIv = orderSize.div(100)
  const orderMoveSkew = orderMoveBaseIv.mul(marketParams.pricingParams.skewAdjustmentFactor).div(UNIT)
  const newBaseIv = isBuy ? baseIv.add(orderMoveBaseIv) : baseIv.sub(orderMoveBaseIv)
  const newSkew = isBuy ? skew.add(orderMoveSkew) : skew.sub(orderMoveSkew)
  return {
    newBaseIv,
    newSkew,
  }
}
