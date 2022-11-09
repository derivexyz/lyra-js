import { Deployment } from '../constants/contracts'

const getLyraDeploymentForChainId = (chainId: number): Deployment => {
  switch (chainId) {
    case 31337:
      return Deployment.Local
    case 420:
      return Deployment.Testnet
    case 10:
      return Deployment.Mainnet
    default:
      throw new Error('Chain ID is not supported by Lyra')
  }
}

export default getLyraDeploymentForChainId
