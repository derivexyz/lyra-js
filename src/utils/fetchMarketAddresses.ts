import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraContract from './getLyraContract'

export default async function fetchMarketAddresses(lyra: Lyra): Promise<MarketContractAddresses[]> {
  const viewer = await getLyraContract(lyra, lyra.version, LyraContractId.OptionMarketViewer)
  return await viewer.getMarketAddresses()
}
