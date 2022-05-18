import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import { Option } from '../option'

export default function getMaxCollateral(
  option: Option,
  postTradeSize: BigNumber,
  isBaseCollateral?: boolean
): BigNumber | null {
  if (option.isCall) {
    if (isBaseCollateral) {
      // size
      return postTradeSize
    } else {
      // no max collateral for cash-secured calls
      return null
    }
  } else {
    // size * strike
    return postTradeSize.mul(option.strike().strikePrice).div(UNIT)
  }
}
