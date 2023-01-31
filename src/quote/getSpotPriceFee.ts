import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { UNIT } from '../constants/bn'
import getTimeWeightedFee from './getTimeWeightedFee'

export default function getSpotPriceFee(board: Board, size: BigNumber) {
  const market = board.market()
  const timeWeightedSpotPriceFee = getTimeWeightedFee(
    board.timeToExpiry,
    market.params.spotPriceFee1xPoint,
    market.params.spotPriceFee2xPoint,
    market.params.spotPriceFeeCoefficient
  )
  const spotPriceFee = timeWeightedSpotPriceFee.mul(size).div(UNIT).mul(board.market().spotPrice).div(UNIT)
  return spotPriceFee
}
