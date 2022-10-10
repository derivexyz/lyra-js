import { Deployment } from '../constants/contracts'

const getLyraDeploymentChainId = (deployment: Deployment): number => {
  switch (deployment) {
    case Deployment.Local:
      return 31337
    case Deployment.Kovan:
      return 69
    case Deployment.Goerli:
      return 420
    case Deployment.Mainnet:
      return 10
  }
}

export default getLyraDeploymentChainId
