import { PopulatedTransaction } from '@ethersproject/contracts'

import Lyra from '../lyra'
import buildTx from './buildTx'
import insertTxGasEstimate from './insertTxGasEstimate'

export default async function buildTxWithGasEstimate(
  lyra: Lyra,
  to: string,
  from: string,
  data: string
): Promise<PopulatedTransaction> {
  const tx = buildTx(lyra, to, from, data)
  return insertTxGasEstimate(lyra, tx)
}
