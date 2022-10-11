import { Deployment } from '../constants/contracts'

const getLyraDeploymentFilename = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'lyra.mockSnx.json'
    case Deployment.Kovan:
      return 'lyra.realPricing.json'
    case Deployment.Mainnet:
      return 'lyra.json'
  }
}

export default getLyraDeploymentFilename
