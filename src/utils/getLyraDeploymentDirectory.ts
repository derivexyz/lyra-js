import { Deployment } from '../constants/contracts'

const getLyraDeploymentDirectory = (deployment: Deployment): string => {
  switch (deployment) {
    case Deployment.Local:
      return 'local'
    case Deployment.Testnet:
      return 'goerli-ovm'
    case Deployment.Mainnet:
      return 'mainnet-ovm'
  }
}

export default getLyraDeploymentDirectory
