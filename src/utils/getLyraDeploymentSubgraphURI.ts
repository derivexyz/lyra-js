import { Chain } from '../constants/chain'

const getLyraDeploymentSubgraphURI = (chain: Chain): string => {
  switch (chain) {
    case Chain.Optimism:
      return 'https://api.lyra.finance/subgraph/optimism/v1/api'
    case Chain.OptimismGoerli:
      return 'https://api.lyra.finance/subgraph/optimism-goerli/v1/api'
    // case Chain.Arbitrum:
    //   return 'https://api.lyra.finance/subgraph/arbitrum/v2/api'
    case Chain.ArbitrumGoerli:
      return 'https://api.lyra.finance/subgraph/arbitrum-goerli/v2/api'
  }
}

export default getLyraDeploymentSubgraphURI
