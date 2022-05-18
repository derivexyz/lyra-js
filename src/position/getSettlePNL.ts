import { BigNumber } from 'ethers'

import { UNIT } from '../constants/bn'

export default function getSettlePNL(
  isLong: boolean,
  isCall: boolean,
  averageCostPerOption: BigNumber,
  expiryPrice: BigNumber,
  strikePrice: BigNumber,
  openSize: BigNumber
): BigNumber {
  /*
  Long call PNL: if (expiryPrice > strikePrice) -> expiryPrice - strikePrice - averagePrice, else = -averagePrice
  Long put PNL: if (expiryPrice < strikePrice) -> strikePrice - expiryPrice - averagePrice, else = -averagePrice
  Short call PNL: if (expiryPrice > strikePrice) -> strikePrice - expiryPrice + averagePrice, else = averagePrice
  Short put PNL:  if (expiryPrice < strikePrice) -> expiryPrice - strikePrice + averagePrice, else = averagePrice
  */
  if (isLong) {
    if (isCall) {
      return (
        expiryPrice.gt(strikePrice)
          ? expiryPrice.sub(strikePrice).sub(averageCostPerOption)
          : averageCostPerOption.mul(-1)
      )
        .mul(openSize)
        .div(UNIT)
    } else {
      return (
        expiryPrice.lt(strikePrice)
          ? strikePrice.sub(expiryPrice).sub(averageCostPerOption)
          : averageCostPerOption.mul(-1)
      )
        .mul(openSize)
        .div(UNIT)
    }
  } else {
    if (isCall) {
      return (
        expiryPrice.gt(strikePrice) ? strikePrice.sub(expiryPrice).add(averageCostPerOption) : averageCostPerOption
      )
        .mul(openSize)
        .div(UNIT)
    } else {
      return (
        expiryPrice.lt(strikePrice) ? expiryPrice.sub(strikePrice).add(averageCostPerOption) : averageCostPerOption
      )
        .mul(openSize)
        .div(UNIT)
    }
  }
}
