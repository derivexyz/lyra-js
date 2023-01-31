import { Chain } from '../constants/chain'

const getLyraChainIdForChain = (chain: Chain): number => {
  switch (chain) {
    case Chain.OptimismGoerli:
      return 420
    case Chain.ArbitrumGoerli:
      return 421613
    case Chain.Optimism:
      return 10
    case Chain.Arbitrum:
      return 42161
    default:
      throw new Error('Chain is not supported by Lyra')
  }
}

export default getLyraChainIdForChain
