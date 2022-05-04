import { BigNumber } from '@ethersproject/bignumber'

export const ZERO_BN = BigNumber.from(0)
export const UNIT = BigNumber.from(10).pow(18)
export const ONE_BN = BigNumber.from(1).mul(UNIT)
export const MAX_BN = BigNumber.from(2).pow(256).sub(1)
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
