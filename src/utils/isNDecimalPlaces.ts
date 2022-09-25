import { BigNumber } from 'ethers'

import fromBigNumber from './fromBigNumber'

// Checks if a BigNumber has greater than (or equal to) n decimal places
export default function isNDecimalPlaces(val: BigNumber, n: number): boolean {
  const exp = 10 ** (n - 1)
  const valNum = fromBigNumber(val)
  const floor = Math.floor(valNum * exp)
  const ceil = Math.ceil(valNum * exp)
  return floor < valNum * exp && valNum * exp < ceil
}
