import { BigNumber } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import { Option } from '../option'

export default function getMaxCollateral(
  option: Option,
  postTradeSize: BigNumber,
  isBaseCollateral?: boolean
): BigNumber {
  if (option.isCall && isBaseCollateral) {
    // size
    return postTradeSize
  } else {
    // size * strike
    return postTradeSize.mul(option.strike().strikePrice).div(UNIT)
  }
}
