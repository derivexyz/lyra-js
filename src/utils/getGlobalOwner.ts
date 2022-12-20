import { LyraContractId } from '../constants/contracts'
import Lyra, { Version } from '../lyra'
import getLyraContract from './getLyraContract'

export default async function getGlobalOwner(lyra: Lyra): Promise<string> {
  if (lyra.version === Version.Avalon) {
    const synthetixAdapter = getLyraContract(lyra, LyraContractId.SynthetixAdapter)
    return await synthetixAdapter.owner()
  }
  const exchangeAdapter = getLyraContract(lyra, LyraContractId.ExchangeAdapter)
  return await exchangeAdapter.owner()
}
