import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import { Option } from '../option'

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
  const market = option.market()
  const orderSize = size.mul(UNIT).div(market.params.standardSize) // 10^18
  const orderMoveBaseIv = orderSize.div(100)
  const orderMoveSkew = orderMoveBaseIv.mul(market.params.skewAdjustmentFactor).div(UNIT)
  const newBaseIv = isBuy ? baseIv.add(orderMoveBaseIv) : baseIv.sub(orderMoveBaseIv)
  const newSkew = isBuy ? skew.add(orderMoveSkew) : skew.sub(orderMoveSkew)
  return {
    newBaseIv,
    newSkew,
  }
}
