import { Contract } from 'ethers'

import { LyraMarketContractId } from '../constants/contracts'
import { LyraMarketContractReturnType } from '../constants/mappings'
import Lyra from '../lyra'
import { MarketContractAddresses } from '../market'
import getLyraContractABI from './getLyraContractABI'

export default function getLyraMarketContractFromAddress<T extends LyraMarketContractId>(
  lyra: Lyra,
  address: string,
  marketContractAddresses: MarketContractAddresses
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
    case 'liquidityPool':
      contractId = LyraMarketContractId.LiquidityPool
      break
    case 'liquidityTokens':
      contractId = LyraMarketContractId.LiquidityTokens
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
  }
  if (!contractId) {
    return null
  }
  const abi = getLyraContractABI(contractId)
  return { contractId, contract: new Contract(address, abi, lyra.provider) as LyraMarketContractReturnType[T] }
}
