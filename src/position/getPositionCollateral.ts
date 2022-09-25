import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getMaxCollateral from '../utils/getMaxCollateral'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'

export type PositionCollateral = {
  amount: BigNumber
  value: BigNumber
  min: BigNumber
  max: BigNumber | null
  isBase: boolean
  liquidationPrice: BigNumber | null
}

export default function getPositionCollateral(
  option: Option,
  size: BigNumber,
  collateral: BigNumber,
  isBaseCollateral?: boolean
): PositionCollateral {
  const strike = option.strike()
  const board = option.board()
  const market = option.market()
  const spotPrice = board.isExpired ? board.spotPriceAtExpiry ?? ZERO_BN : market.spotPrice
  return {
    amount: collateral,
    value: isBaseCollateral ? collateral.mul(spotPrice).div(UNIT) : collateral,
    min: getMinCollateralForSpotPrice(option, size, spotPrice, isBaseCollateral),
    max: getMaxCollateral(option.isCall, strike.strikePrice, size, isBaseCollateral),
    isBase: option.isCall ? !!isBaseCollateral : false,
    liquidationPrice: getLiquidationPrice(option, size, collateral, isBaseCollateral),
  }
}
