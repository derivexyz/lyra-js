import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers'

import { Deployment } from '../constants/contracts'
import getLyraDeploymentChainId from './getLyraDeploymentChainId'
import getLyraDeploymentRPCURL from './getLyraDeploymentRPCURL'

const getLyraDeploymentProvider = (deployment: Deployment): JsonRpcProvider => {
  const rpcUrl = getLyraDeploymentRPCURL(deployment)
  const chainId = getLyraDeploymentChainId(deployment)
  return new StaticJsonRpcProvider(rpcUrl, chainId)
}

export default getLyraDeploymentProvider
