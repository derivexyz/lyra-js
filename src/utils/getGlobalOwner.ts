import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

export default async function getGlobalOwner(lyra: Lyra): Promise<string> {
  const synthetixAdapter = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.SynthetixAdapter)
  return await synthetixAdapter.owner()
}
