import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraContract from './getLyraContract'

export default async function getMarketAddresses(lyra: Lyra): Promise<MarketContractAddresses[]> {
  const viewer = await getLyraContract(lyra, LyraContractId.OptionMarketViewer)
  return viewer.getMarketAddresses()
}
