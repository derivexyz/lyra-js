import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'

export default function getMaxCollateral(
  isCall: boolean,
  strikePrice: BigNumber,
  postTradeSize: BigNumber,
  isBaseCollateral?: boolean
): BigNumber | null {
  if (isCall) {
    if (isBaseCollateral) {
      // size
      return postTradeSize
    } else {
      // no max collateral for cash-secured calls
      return null
    }
  } else {
    // size * strike
    return postTradeSize.mul(strikePrice).div(UNIT)
  }
}
