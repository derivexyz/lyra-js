import { ethers } from 'ethers'

import { Deployment } from '../../constants/contracts'
import Lyra from '../../lyra'
import getLyraDeploymentChainId from '../../utils/getLyraDeploymentChainId'

const getDeploymentRpcUrl = (deployment: Deployment) => {
  switch (deployment) {
    case Deployment.Local:
      return 'http://127.0.0.1:8545'
    case Deployment.Kovan:
      return 'https://kovan.optimism.io'
  }
}

export type ScriptLyra = {
  lyra: Lyra
  signer: ethers.Wallet
}

export default function getScriptLyra(argv: string[]): ScriptLyra {
  // TODO: @earthtojake Get deployment + rpc url from argv
  const deploymentIndex = argv.findIndex(arg => arg === '-d' || arg === '--deployment')
  const deployment = deploymentIndex != -1 ? (argv[deploymentIndex + 1] as Deployment) : Deployment.Kovan
  const rpcUrl = process.env.RPC_URL ?? getDeploymentRpcUrl(deployment)
  const chainId = getLyraDeploymentChainId(deployment)
  if (!rpcUrl) {
    throw new Error('Invalid deployment')
  }
  const lyra = new Lyra({ rpcUrl, chainId })
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is missing in environment')
  }
  const signer = new ethers.Wallet(privateKey, lyra.provider)
  return { lyra, signer }
}
