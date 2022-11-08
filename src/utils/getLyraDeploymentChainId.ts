import { Deployment } from '../constants/contracts'

const getLyraDeploymentChainId = (deployment: Deployment): number => {
  switch (deployment) {
    case Deployment.Local:
      return 31337
    case Deployment.Testnet:
      return 420
    case Deployment.Mainnet:
      return 10
  }
}

export default getLyraDeploymentChainId
