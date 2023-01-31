import { PopulatedTransaction } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import { UNIT } from '../constants/bn'
import toBigNumber from './toBigNumber'

const GAS_SLIPPAGE = 0.1 // 10%

export default async function insertTxGasEstimate(
  provider: JsonRpcProvider,
  tx: PopulatedTransaction
): Promise<PopulatedTransaction> {
  const gasEstimate = await provider.estimateGas(tx)
  const gasLimit = gasEstimate.mul(toBigNumber(1 + GAS_SLIPPAGE)).div(UNIT)
  return {
    ...tx,
    gasLimit,
  }
}
