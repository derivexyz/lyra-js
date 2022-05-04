import { BigNumber } from '@ethersproject/bignumber'

import Board from '../board'
import { UNIT } from '../constants/bn'
import getTimeWeightedFee from './getTimeWeightedFee'

export default function getSpotPriceFee(board: Board, size: BigNumber) {
  const pricingParams = board.market().__marketData.marketParameters.pricingParams
  const timeWeightedSpotPriceFee = getTimeWeightedFee(
    board.timeToExpiry,
    pricingParams.spotPriceFee1xPoint.toNumber(),
    pricingParams.spotPriceFee2xPoint.toNumber(),
    pricingParams.spotPriceFeeCoefficient
  )
  const spotPriceFee = timeWeightedSpotPriceFee.mul(size).div(UNIT).mul(board.market().spotPrice).div(UNIT)
  return spotPriceFee
}
