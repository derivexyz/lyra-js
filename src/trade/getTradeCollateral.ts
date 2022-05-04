import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { Option } from '../option'
import getLiquidationPrice from '../utils/getLiquidationPrice'
import getMaxCollateral from '../utils/getMaxCollateral'
import getMinCollateralForSpotPrice from '../utils/getMinCollateralForSpotPrice'
import toBigNumber from '../utils/toBigNumber'

export type TradeCollateral = {
  amount: BigNumber
  min: BigNumber
  current: BigNumber
  max: BigNumber
  isBase?: boolean
  liquidationPrice: BigNumber
}

export default function getTradeCollateral({
  option,
  prevTradeSize,
  postTradeSize,
  currentCollateral,
  setToCollateral: _setCollateralTo,
  useFullCollateral,
  usePositionCollateralRatio,
  minCollateralBuffer = 0,
  maxCollateralBuffer = 0,
  isBaseCollateral,
}: {
  option: Option
  prevTradeSize: BigNumber
  postTradeSize: BigNumber
  currentCollateral: BigNumber
  setToCollateral?: BigNumber
  useFullCollateral?: boolean
  usePositionCollateralRatio?: boolean
  minCollateralBuffer?: number
  maxCollateralBuffer?: number
  isBaseCollateral?: boolean
}): TradeCollateral {
  if (postTradeSize.isZero()) {
    // Position is being closed
    return {
      amount: ZERO_BN,
      min: ZERO_BN,
      current: currentCollateral,
      max: ZERO_BN,
      isBase: isBaseCollateral,
      liquidationPrice: ZERO_BN,
    }
  }

  const spotPrice = option.market().spotPrice
  // Apply buffer to min collateral
  // TODO: @earthtojake Check static collat and ignore buffer when it is sufficiently below
  const minCollateral = getMinCollateralForSpotPrice(option, postTradeSize, spotPrice, isBaseCollateral)
    .mul(toBigNumber(1 + minCollateralBuffer))
    .div(UNIT)
  let maxCollateral = getMaxCollateral(option, postTradeSize, isBaseCollateral)
  if (option.isCall && !isBaseCollateral) {
    // Apply buffer to max collateral
    maxCollateral = maxCollateral.mul(toBigNumber(1 + maxCollateralBuffer)).div(UNIT)
  }
  if (minCollateral.gt(maxCollateral)) {
    // Account for case where min collateral is greater than max
    maxCollateral = minCollateral
  }

  const prevMaxCollateral = getMaxCollateral(option, prevTradeSize, isBaseCollateral)

  let setToCollateral: BigNumber
  if (usePositionCollateralRatio && prevMaxCollateral.gt(0)) {
    if (postTradeSize.eq(prevTradeSize)) {
      // No collateral change
      setToCollateral = currentCollateral
    } else {
      // Set based on current c-ratio
      const prevCollateral = currentCollateral
      setToCollateral = prevCollateral.mul(UNIT).div(prevMaxCollateral).mul(maxCollateral).div(UNIT)
      if (setToCollateral.gt(maxCollateral)) {
        setToCollateral = maxCollateral
      } else if (setToCollateral.lt(minCollateral)) {
        setToCollateral = minCollateral
      }
    }
  } else if (useFullCollateral) {
    setToCollateral = maxCollateral
  } else {
    setToCollateral = _setCollateralTo ?? ZERO_BN
  }

  const liquidationPrice = getLiquidationPrice(option, postTradeSize, setToCollateral, isBaseCollateral)

  return {
    isBase: option.isCall ? isBaseCollateral : undefined,
    max: maxCollateral,
    min: minCollateral,
    liquidationPrice,
    current: currentCollateral,
    amount: setToCollateral,
  }
}
