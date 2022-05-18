import { LyraMarketContractId } from '../constants/contracts'
import { OptionGreekCache, OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import getLyraMarketContract from './getLyraMarketContract'

export default async function getGreekCacheParams(
  lyra: Lyra,
  marketAddresses: OptionMarketViewer.OptionMarketAddressesStructOutput
): Promise<OptionGreekCache.GreekCacheParametersStructOutput> {
  const optionMarket = getLyraMarketContract(lyra, marketAddresses, LyraMarketContractId.OptionGreekCache)
  return await optionMarket.getGreekCacheParams()
}
