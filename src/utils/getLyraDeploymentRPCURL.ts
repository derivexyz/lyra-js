import { Chain } from '../constants/chain'

const getLyraDeploymentRPCURL = (chain: Chain): string => {
  switch (chain) {
    case Chain.Optimism:
      return 'https://mainnet.optimism.io'
    case Chain.OptimismGoerli:
      return 'https://goerli.optimism.io'
    // case Chain.Arbitrum:
    //   return 'https://arb1.arbitrum.io/rpc'
    case Chain.ArbitrumGoerli:
      return 'https://goerli-rollup.arbitrum.io/rpc'
  }
}

export default getLyraDeploymentRPCURL
