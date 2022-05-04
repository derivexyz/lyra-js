import { Deployment } from '../constants/contracts'

const getLyraDeploymentChainId = (deployment: Deployment): number => {
  switch (deployment) {
    case Deployment.Local:
      return 31337
    case Deployment.Kovan:
      return 69
  }
}

export default getLyraDeploymentChainId
