import { BigNumber } from '@ethersproject/bignumber'

export function from18DecimalBN(val: BigNumber, decimals: number): BigNumber {
  return val.div(BigNumber.from(10).pow(18 - decimals))
}
export function to18DecimalBN(val: BigNumber, decimals: number): BigNumber {
  return val.mul(BigNumber.from(10).pow(18 - decimals))
}
