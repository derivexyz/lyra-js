import { LyraMarketContractId } from '../constants/contracts'
import { LyraMarketContractReturnType } from '../constants/mappings'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraMarketContract from './getLyraMarketContract'

export default function getLyraMarketContractForAddress<T extends LyraMarketContractId>(
  lyra: Lyra,
  marketContractAddresses: MarketContractAddresses,
  address: string
): { contractId: string; contract: LyraMarketContractReturnType[T] } | null {
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
    contract: getLyraMarketContract(
      lyra,
      marketContractAddresses,
      contractId
    ) as unknown as LyraMarketContractReturnType[T],
  }
}
