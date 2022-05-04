import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { UNIT } from '../constants/bn'
import getTimeWeightedFee from './getTimeWeightedFee'

export default function getOptionPriceFee(board: Board, pricePerOption: BigNumber, size: BigNumber) {
  const pricingParams = board.market().__marketData.marketParameters.pricingParams
  const timeWeightedOptionPriceFee = getTimeWeightedFee(
    board.timeToExpiry,
    pricingParams.optionPriceFee1xPoint.toNumber(),
    pricingParams.optionPriceFee2xPoint.toNumber(),
    pricingParams.optionPriceFeeCoefficient
  )
  return timeWeightedOptionPriceFee.mul(size).div(UNIT).mul(pricePerOption).div(UNIT)
}
