import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'

export default function toBigNumber(number: number, decimals: number = 18): BigNumber {
  if (isNaN(number)) {
    throw new Error('Passed NaN to BigNumber converter')
  }
  return parseUnits(number.toFixed(18), decimals)
}
