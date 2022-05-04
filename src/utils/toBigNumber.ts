import { parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'

export default function toBigNumber(number: number, decimals: number = 18): BigNumber {
  if (isNaN(number)) {
    throw new Error('Passed NaN to BigNumber converter')
  }
  return parseUnits(number.toFixed(18), decimals)
}
