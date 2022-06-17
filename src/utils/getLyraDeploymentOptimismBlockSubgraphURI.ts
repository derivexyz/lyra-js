import { Deployment } from '../constants/contracts'

const getLyraDeploymentOptimismBlockSubgraphURI = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'http://127.0.0.1:8081'
    case Deployment.Kovan:
      return 'https://api.thegraph.com/subgraphs/name/lyra-finance/optimism-kovan-blocks'
    case Deployment.Mainnet:
      return 'https://api.thegraph.com/subgraphs/name/lyra-finance/optimism-mainnet-blocks'
  }
}

export default getLyraDeploymentOptimismBlockSubgraphURI
