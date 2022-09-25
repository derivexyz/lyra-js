import { BigNumber } from 'ethers'

import Lyra from '..'
import { LyraContractId } from '../constants/contracts'
import getLyraContract from './getLyraContract'

export default async function getSwapQuote(
  lyra: Lyra,
  from: string,
  to: string,
  amountIn: BigNumber
): Promise<BigNumber> {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const [poolAddress, amountOut] = await wrapper.quoteCurveSwap(from, to, amountIn)
  return amountOut
}
