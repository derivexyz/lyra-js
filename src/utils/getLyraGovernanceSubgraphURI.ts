import { Chain } from '../constants/chain'

const getLyraGovernanceSubgraphURI = (chain: Chain): string => {
  switch (chain) {
    case Chain.Optimism:
    case Chain.OptimismGoerli:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/optimism-governance/api'
    case Chain.Arbitrum:
    case Chain.ArbitrumGoerli:
      return 'https://subgraph.satsuma-prod.com/d14de8f7fd46/lyra/arbitrum-governance/api'
  }
}

export default getLyraGovernanceSubgraphURI
