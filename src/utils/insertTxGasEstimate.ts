import { PopulatedTransaction } from '@ethersproject/contracts'

import { UNIT } from '../constants/bn'
import Lyra from '../lyra'
import toBigNumber from './toBigNumber'

const GAS_SLIPPAGE = 0.1 // 10%

export default async function insertTxGasEstimate(lyra: Lyra, tx: PopulatedTransaction): Promise<PopulatedTransaction> {
  const gasEstimate = await lyra.provider.estimateGas(tx)
  const gasLimit = gasEstimate.mul(toBigNumber(1 + GAS_SLIPPAGE)).div(UNIT)
  return {
    ...tx,
    gasLimit,
  }
}
