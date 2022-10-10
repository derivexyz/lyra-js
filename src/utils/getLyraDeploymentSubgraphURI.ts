import { Deployment } from '../constants/contracts'

const getLyraDeploymentSubgraphURI = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'http://127.0.0.1:8080'
    case Deployment.Kovan:
      return 'https://api.thegraph.com/subgraphs/name/lyra-finance/kovan'
    case Deployment.Goerli:
      return 'https://api.thegraph.com/subgraphs/name/lyra-finance/testnet'
    case Deployment.Mainnet:
      return 'https://api.thegraph.com/subgraphs/name/lyra-finance/mainnet'
  }
}

export default getLyraDeploymentSubgraphURI
