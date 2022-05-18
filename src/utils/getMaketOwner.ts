import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default async function getMarketOwner(
  lyra: Lyra,
  marketContractAddresses: MarketContractAddresses
): Promise<string> {
  const optionMarket = getLyraMarketContract(lyra, marketContractAddresses, LyraMarketContractId.OptionMarket)
  return await optionMarket.owner()
}
