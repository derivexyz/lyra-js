import { Deployment } from '../constants/contracts'

const getLyraDeploymentDirectory = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'local'
    case Deployment.Kovan:
      return 'kovan-ovm'
    case Deployment.Mainnet:
      return 'mainnet-ovm'
  }
}

export default getLyraDeploymentDirectory
