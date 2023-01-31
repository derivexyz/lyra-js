import { LyraMarketContractId } from '../constants/contracts'
import { LyraMarketContractMap } from '../constants/mappings'
import Lyra, { Version } from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default function getLyraMarketContractForAddress<V extends Version, C extends LyraMarketContractId>(
  lyra: Lyra,
  version: V,
  marketContractAddresses: MarketContractAddresses,
  address: string
): { contractId: string; contract: LyraMarketContractMap<V, C> } | null {
  const keyValPair = Object.entries(marketContractAddresses).find(
    ([key, val]) => isNaN(parseInt(key)) && val === address
  )
  if (!keyValPair) {
    return null
  }
  const [key] = keyValPair
  let contractId
  switch (key) {
    case 'optionMarketPricer':
      contractId = LyraMarketContractId.OptionMarketPricer
      break
    case 'liquidityPool':
      contractId = LyraMarketContractId.LiquidityPool
      break
    case 'liquidityToken':
      contractId = LyraMarketContractId.LiquidityToken
      break
    case 'greekCache':
      contractId = LyraMarketContractId.OptionGreekCache
      break
    case 'optionMarket':
      contractId = LyraMarketContractId.OptionMarket
      break
    case 'optionToken':
      contractId = LyraMarketContractId.OptionToken
      break
    case 'shortCollateral':
      contractId = LyraMarketContractId.ShortCollateral
      break
    case 'poolHedger':
      contractId = LyraMarketContractId.PoolHedger
      break
  }
  if (!contractId) {
    return null
  }
  return {
    contractId,
    contract: getLyraMarketContract(lyra, marketContractAddresses, version, contractId) as LyraMarketContractMap<V, C>,
  }
}
