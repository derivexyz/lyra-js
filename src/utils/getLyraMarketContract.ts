import { Contract } from 'ethers'

import Lyra from '..'
import { LyraMarketContractId } from '../constants/contracts'
import { LyraMarketContractReturnType } from '../constants/mappings'
import { MarketContractAddresses } from '../market'
import getLyraContractABI from './getLyraContractABI'

const getContractAddress = (marketAddresses: MarketContractAddresses, contractId: LyraMarketContractId): string => {
  switch (contractId) {
    case LyraMarketContractId.OptionMarket:
      return marketAddresses.optionMarket
    case LyraMarketContractId.OptionToken:
      return marketAddresses.optionToken
    case LyraMarketContractId.ShortCollateral:
      return marketAddresses.shortCollateral
    case LyraMarketContractId.OptionGreekCache:
      return marketAddresses.greekCache
  }
}

export default function getLyraMarketContract<T extends LyraMarketContractId>(
  lyra: Lyra,
  marketContractAddresses: MarketContractAddresses,
  contractId: T
): LyraMarketContractReturnType[T] {
  const abi = getLyraContractABI(contractId)
  const address = getContractAddress(marketContractAddresses, contractId)
  return new Contract(address, abi, lyra.provider) as LyraMarketContractReturnType[T]
}
