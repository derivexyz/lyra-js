import { Chain } from '../constants/chain'
import Lyra from '../lyra'

const getLyraGovernanceSubgraphURI = (lyra: Lyra, chain: Chain | 'ethereum'): string => {
  switch (chain) {
    case 'ethereum':
    case Chain.Optimism:
    case Chain.OptimismGoerli:
      return new URL(`/subgraph/optimism-governance/v1/api`, lyra.apiUri).toString()
    case Chain.Arbitrum:
    case Chain.ArbitrumGoerli:
      return new URL(`/subgraph/arbitrum-governance/v1/api`, lyra.apiUri).toString()
  }
}

export default getLyraGovernanceSubgraphURI
