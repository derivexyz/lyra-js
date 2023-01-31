import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'

export default function getPriceVariance(price: BigNumber, refPrice: BigNumber) {
  return price.mul(UNIT).div(refPrice).sub(UNIT).abs()
}
