import { BigNumber } from '@ethersproject/bignumber'

import { Trade } from '..'
import { MAX_BN, UNIT } from '../constants/bn'

export default function getMaxLoss(trade: Trade): BigNumber {
  if (trade.isCall && trade.isBuy) {
    return trade.premium
  } else if (trade.isCall && !trade.isBuy) {
    return MAX_BN
  } else if (!trade.isCall && trade.isBuy) {
    return trade.premium
  } else {
    return trade.strikePrice.sub(trade.pricePerOption).mul(trade.size).div(UNIT)
  }
}
