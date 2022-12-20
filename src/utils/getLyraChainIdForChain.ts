import { Chain } from '../constants/chain'

const getLyraChainForChainId = (chain: Chain): number => {
  switch (chain) {
    case Chain.OptimismGoerli:
      return 420
    case Chain.ArbitrumGoerli:
      return 421613
    case Chain.Optimism:
      return 10
    // case 42161:
    //   return Chain.Arbitrum
    default:
      throw new Error('Chain is not supported by Lyra')
  }
}

export default getLyraChainForChainId
