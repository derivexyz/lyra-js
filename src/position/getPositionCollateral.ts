import { BigNumber } from '@ethersproject/bignumber'

import { Option } from '../option'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getMaxCollateral from '../utils/getMaxCollateral'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'

export type PositionCollateral = {
  amount: BigNumber
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
  return {
    amount: collateral,
    min: getMinCollateralForSpotPrice(option, size, option.market().spotPrice, isBaseCollateral),
    max: getMaxCollateral(option.isCall, option.strike().strikePrice, size, isBaseCollateral),
    isBase: option.isCall ? !!isBaseCollateral : false,
    liquidationPrice: getLiquidationPrice(option, size, collateral, isBaseCollateral),
  }
}
