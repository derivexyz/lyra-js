import { ethers } from 'ethers'

import Lyra from '../..'
import { Deployment } from '../../constants/contracts'
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
  wait: (hash: string) => Promise<ethers.providers.TransactionReceipt>
}

export default function getScriptLyra(argv: string[]): ScriptLyra {
  // TODO: @earthtojake Get deployment + rpc url from argv
  const deploymentIndex = argv.findIndex(arg => arg === '-d' || arg === '--deployment')
  const deployment = deploymentIndex != -1 ? (argv[deploymentIndex + 1] as Deployment) : Deployment.Kovan
  const rpcUrl = getDeploymentRpcUrl(deployment)
  const chainId = getLyraDeploymentChainId(deployment)
  if (!rpcUrl) {
    throw new Error('Invalid deployment')
  }
  const lyra = new Lyra({ rpcUrl, chainId })
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is missing in environment')
  }
  const wallet = new ethers.Wallet(privateKey)
  const signer = wallet.connect(lyra.provider)
  const wait = (hash: string) => lyra.provider.waitForTransaction(hash, deployment === Deployment.Local ? undefined : 2)
  return { lyra, signer, wait }
}
