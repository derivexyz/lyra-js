import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'

// Base calculation for an option payoff
// Set baseCollateralOptions to account for partially collateralized covered calls
export default function getProjectedSettlePnl(
  isLong: boolean,
  isCall: boolean,
  strikePrice: BigNumber,
  spotPriceAtExpiry: BigNumber,
  pricePerOption: BigNumber,
  size: BigNumber,
  liquidationPrice?: BigNumber | null
): BigNumber {
  if (isLong) {
    if (isCall) {
      // Long call
      return (
        spotPriceAtExpiry.gte(strikePrice)
          ? // ITM
            spotPriceAtExpiry.sub(strikePrice).sub(pricePerOption)
          : // OTM
            pricePerOption.mul(-1)
      )
        .mul(size)
        .div(UNIT)
    } else {
      // Long put
      return (
        spotPriceAtExpiry.lte(strikePrice)
          ? // ITM
            strikePrice.sub(spotPriceAtExpiry).sub(pricePerOption)
          : // OTM
            pricePerOption.mul(-1)
      )
        .mul(size)
        .div(UNIT)
    }
  } else {
    if (isCall) {
      return (
        liquidationPrice && spotPriceAtExpiry.gte(liquidationPrice)
          ? pricePerOption.sub(spotPriceAtExpiry) // Liquidation (max loss)
          : spotPriceAtExpiry.lte(strikePrice)
          ? // OTM
            pricePerOption
          : // ITM
            pricePerOption.sub(spotPriceAtExpiry).add(strikePrice)
      )
        .mul(size)
        .div(UNIT)
    } else {
      // Cash secured put
      return (
        liquidationPrice && spotPriceAtExpiry.lte(liquidationPrice)
          ? pricePerOption.sub(strikePrice) // Liquidation (max loss)
          : spotPriceAtExpiry.lte(strikePrice)
          ? // ITM
            spotPriceAtExpiry.sub(strikePrice).add(pricePerOption)
          : // OTM
            pricePerOption
      )
        .mul(size)
        .div(UNIT)
    }
  }
}
