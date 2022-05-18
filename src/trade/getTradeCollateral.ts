import { BigNumber } from '@ethersproject/bignumber'

import { TradeCollateral } from '..'
import { ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getMaxCollateral from '../utils/getMaxCollateral'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'

export default function getTradeCollateral({
  option,
  postTradeSize,
  setToCollateral: _setCollateralTo,
  setToFullCollateral,
  isBaseCollateral,
}: {
  option: Option
  postTradeSize: BigNumber
  setToCollateral?: BigNumber
  setToFullCollateral?: boolean
  isBaseCollateral?: boolean
}): TradeCollateral {
  if (postTradeSize.isZero()) {
    // Position is being closed
    return {
      amount: ZERO_BN,
      min: ZERO_BN,
      max: ZERO_BN,
      isMin: false,
      isMax: false,
      liquidationPrice: null,
    }
  }

  const market = option.market()

  const spotPrice = market.spotPrice
  const minCollateral = getMinCollateralForSpotPrice(option, postTradeSize, spotPrice, isBaseCollateral)
  let maxCollateral = getMaxCollateral(option, postTradeSize, isBaseCollateral)
  if (maxCollateral && minCollateral.gt(maxCollateral)) {
    // Account for case where min collateral is greater than max
    maxCollateral = minCollateral
  }

  let setToCollateral: BigNumber
  // TODO: Maintain current position collateral
  if (setToFullCollateral) {
    if (!maxCollateral) {
      // No max collateral for cash-secured short calls
      throw new Error('Cannot fully collateralize a cash-secured short call')
    }
    setToCollateral = maxCollateral
  } else {
    setToCollateral = _setCollateralTo ?? ZERO_BN
  }

  const isMin = setToCollateral.lte(minCollateral)
  const isMax = !!(maxCollateral && setToCollateral.gte(maxCollateral))

  const liquidationPrice = getLiquidationPrice(option, postTradeSize, setToCollateral, isBaseCollateral)

  return {
    amount: setToCollateral,
    isBase: option.isCall ? isBaseCollateral : undefined,
    max: maxCollateral,
    min: minCollateral,
    isMin,
    isMax,
    liquidationPrice,
  }
}
