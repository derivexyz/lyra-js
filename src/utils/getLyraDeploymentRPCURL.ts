import { Deployment } from '../constants/contracts'

const getLyraDeploymentRPCURL = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'http://127.0.0.1:8545'
    case Deployment.Testnet:
      return 'https://goerli.optimism.io'
    case Deployment.Mainnet:
      return 'https://mainnet.optimism.io'
  }
}

export default getLyraDeploymentRPCURL
