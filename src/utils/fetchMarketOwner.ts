import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default async function fetchMarketOwner(
  lyra: Lyra,
  marketContractAddresses: MarketContractAddresses
): Promise<string> {
  const optionMarket = getLyraMarketContract(
    lyra,
    marketContractAddresses,
    lyra.version,
    LyraMarketContractId.OptionMarket
  )
  return await optionMarket.owner()
}
