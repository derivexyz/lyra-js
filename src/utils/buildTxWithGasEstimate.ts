import { PopulatedTransaction } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import buildTx from './buildTx'
import insertTxGasEstimate from './insertTxGasEstimate'

export default async function buildTxWithGasEstimate(
  provider: JsonRpcProvider,
  chainId: number,
  to: string,
  from: string,
  data: string
): Promise<PopulatedTransaction> {
  const tx = buildTx(provider, chainId, to, from, data)
  return insertTxGasEstimate(provider, tx)
}
