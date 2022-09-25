import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraContract from './getLyraContract'

export default async function getMarketAddresses(lyra: Lyra): Promise<MarketContractAddresses[]> {
  return await getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer).getMarketAddresses()
}
