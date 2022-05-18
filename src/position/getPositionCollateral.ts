import { BigNumber } from '@ethersproject/bignumber'

import { Option } from '../option'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'

export type PositionCollateral = {
  amount: BigNumber
  min: BigNumber
  isBase?: boolean
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
    isBase: isBaseCollateral,
    liquidationPrice: getLiquidationPrice(option, size, collateral, isBaseCollateral),
  }
}
