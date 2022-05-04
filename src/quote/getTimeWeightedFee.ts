import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import toBigNumber from '../utils/toBigNumber'

export default function getTimeWeightedFee(
  timeToExpiry: number,
  pointA: number,
  pointB: number,
  coefficient: BigNumber
) {
  if (timeToExpiry <= pointA) {
    return coefficient
  } else {
    const factor = toBigNumber(timeToExpiry - pointA)
      .mul(UNIT)
      .div(pointB - pointA)
      .div(UNIT)
    return coefficient.mul(UNIT.add(factor)).div(UNIT)
  }
}
