import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

export default async function getMarketAddresses(lyra: Lyra): Promise<string[]> {
  // Never runs out of gas
  return await getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer).getMarketAddresses()
}
