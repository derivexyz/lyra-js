import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

export default async function fetchGlobalOwner(lyra: Lyra): Promise<string> {
  const exchangeAdapter = getLyraContract(lyra, lyra.version, LyraContractId.ExchangeAdapter)
  return await exchangeAdapter.owner()
}
