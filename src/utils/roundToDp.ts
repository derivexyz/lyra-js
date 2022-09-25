import { BigNumber } from '@ethersproject/bignumber'

import { ZERO_BN } from '../constants/bn'

type Options = {
  ceil?: boolean
  bnDecimals?: number
}

// Round a BN to n decimal places, aassumes BN is 10^18
export default function roundToDp(val: BigNumber, n: number, options?: Options): BigNumber {
  if (val.isZero()) {
    return ZERO_BN
  }
  const bnDecimals = options?.bnDecimals ?? 18
  let valBN = val.div(BigNumber.from(10).pow(bnDecimals - n))
  const ceil = options?.ceil ?? true
  if (ceil) {
    valBN = valBN.add(1)
  }
  return valBN.mul(BigNumber.from(10).pow(bnDecimals - n))
}
