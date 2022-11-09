import { Deployment } from '../constants/contracts'

const getLyraDeploymentSubgraphURI = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'http://127.0.0.1:8080'
    case Deployment.Testnet:
      return 'https://subgraph.satsuma-prod.com/lyra/optimism-goerli/api'
    case Deployment.Mainnet:
      return 'https://subgraph.satsuma-prod.com/lyra/optimism-mainnet/api'
  }
}

export default getLyraDeploymentSubgraphURI
