import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers'

import { Chain } from '../constants/chain'
import getLyraDeploymentChainId from './getLyraDeploymentChainId'
import getLyraDeploymentRPCURL from './getLyraDeploymentRPCURL'

const getLyraDeploymentProvider = (chain: Chain): JsonRpcProvider => {
  const rpcUrl = getLyraDeploymentRPCURL(chain)
  const chainId = getLyraDeploymentChainId(chain)
  return new StaticJsonRpcProvider(rpcUrl, chainId)
}

export default getLyraDeploymentProvider
