import { Chain } from '../constants/chain'

const getLyraDeploymentSubgraphURI = (chain: Chain): string => {
  switch (chain) {
    case Chain.Optimism:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/optimism-mainnet/api'
    case Chain.OptimismGoerli:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/optimism-goerli/api'
    case Chain.Arbitrum:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/arbitrum-mainnet/api'
    case Chain.ArbitrumGoerli:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/arbitrum-goerli/api'
  }
}

export default getLyraDeploymentSubgraphURI
