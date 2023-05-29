import { BigNumber } from 'ethers'

import { PoolHedgerParams } from '..'
import { UNIT } from '../constants/bn'
import { Option } from '../option'

export default function getCappedExpectedHedge(
  option: Option,
  size: BigNumber,
  netDelta: BigNumber,
  poolHedgerParams: PoolHedgerParams,
  increasesPoolDelta: boolean
) {
  const hedgeCap = poolHedgerParams.hedgeCap
  // netDelta += amount * cached delta * direction
  const deltaImpact = size
    .mul(option.delta)
    .div(UNIT)
    .mul(increasesPoolDelta ? 1 : -1)
  const expectedHedge = netDelta.add(deltaImpact)
  const exceedsCap = expectedHedge.abs().gt(hedgeCap)
  const cappedExpectedHedge = exceedsCap ? (expectedHedge.lt(0) ? hedgeCap.mul(-1) : hedgeCap) : expectedHedge
  return cappedExpectedHedge
}
