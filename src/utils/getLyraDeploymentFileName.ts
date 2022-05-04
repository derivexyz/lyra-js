import { Deployment } from '../constants/contracts'

const getLyraDeploymentFileName = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'lyra.mockSnx.json'
    case Deployment.Kovan:
      return 'lyra.realPricing.json'
  }
}

export default getLyraDeploymentFileName
