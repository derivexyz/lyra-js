import { Chain } from '../constants/chain'

const getLyraDeploymentChainId = (chain: Chain): number => {
  switch (chain) {
    case Chain.Optimism:
      return 10
    case Chain.OptimismGoerli:
      return 420
    // case Chain.Arbitrum:
    //   return 42161
    case Chain.ArbitrumGoerli:
      return 421613
  }
}

export default getLyraDeploymentChainId
