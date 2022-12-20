import { StaticJsonRpcProvider } from '@ethersproject/providers'

import Lyra, { Chain, Version } from '../../src'
import getLyraDeploymentChainId from '../../src/utils/getLyraDeploymentChainId'
import getLyraDeploymentRPCURL from '../../src/utils/getLyraDeploymentRPCURL'

export default function getLyra(): Lyra {
  const chainIndex = process.argv.findIndex(arg => arg === '-ch' || arg === '--chain')
  const versionIndex = process.argv.findIndex(arg => arg === '--sdkVersion')
  const chain = chainIndex !== -1 ? (process.argv[chainIndex + 1] as Chain) : Chain.Optimism
  const version = versionIndex !== -1 ? (process.argv[versionIndex + 1] as Version) : Version.Avalon
  const chainId = getLyraDeploymentChainId(chain)
  const rpcUrl = process.env.RPC_URL ?? getLyraDeploymentRPCURL(chain)
  const lyra = new Lyra({ provider: new StaticJsonRpcProvider(rpcUrl, chainId) }, version)
  return lyra
}
