import { ethers } from 'ethers'

import Lyra from '..'
import { UNIT } from '../constants/bn'
import buildTx from './buildTx'
import toBigNumber from './toBigNumber'

const GAS_SLIPPAGE = 0.1 // 10%

export default async function buildTxWithGasEstimate(
  lyra: Lyra,
  to: string,
  from: string,
  data: string
): Promise<ethers.PopulatedTransaction> {
  const tx = buildTx(lyra, to, from, data)
  const gasEstimate = await lyra.provider.estimateGas(tx)
  return {
    ...tx,
    gasLimit: gasEstimate.mul(toBigNumber(1 + GAS_SLIPPAGE)).div(UNIT),
  }
}
