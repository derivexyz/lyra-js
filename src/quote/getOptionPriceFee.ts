import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { UNIT } from '../constants/bn'
import getTimeWeightedFee from './getTimeWeightedFee'

export default function getOptionPriceFee(board: Board, pricePerOption: BigNumber, size: BigNumber) {
  const market = board.market()
  const timeWeightedOptionPriceFee = getTimeWeightedFee(
    board.timeToExpiry,
    market.params.optionPriceFee1xPoint,
    market.params.optionPriceFee2xPoint,
    market.params.optionPriceFeeCoefficient
  )
  return timeWeightedOptionPriceFee.mul(size).div(UNIT).mul(pricePerOption).div(UNIT)
}
