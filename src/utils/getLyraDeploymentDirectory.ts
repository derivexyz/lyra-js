import { Deployment } from '../constants/contracts'

const getLyraDeploymentDirectory = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'local'
    case Deployment.Kovan:
      return 'kovan-ovm'
  }
}

export default getLyraDeploymentDirectory
