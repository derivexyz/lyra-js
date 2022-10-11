import fs from 'fs-extra'
import path from 'path'
import yargs from 'yargs/yargs'

import { Deployment, LyraContractId } from '../constants/contracts'
import getLyraDeploymentDirectory from '../utils/getLyraDeploymentDirectory'
import getLyraDeploymentFilename from '../utils/getLyraDeploymentFilename'

const LYRA_TARGETS = [
  LyraContractId.OptionMarketViewer,
  LyraContractId.OptionMarketWrapper,
  LyraContractId.SynthetixAdapter,
  LyraContractId.TestFaucet,
  LyraContractId.LyraRegistry,
]

export default async function syncAddresses(_argv: string[]): Promise<void> {
  console.log('sync addresses')
  const argv = await yargs(_argv).options({
    deployment: { choices: Object.values(Deployment), demandOption: true, alias: 'd' },
  }).argv
  const deployment: Deployment = argv.deployment as unknown as Deployment
  const deploymentsDir = path.join(__dirname, '../../../../lyra/deployments', getLyraDeploymentDirectory(deployment))
  // TODO: @dappbeast account for other envs
  const lyraFileName = getLyraDeploymentFilename(deployment)
  const lyraFilePath = path.join(deploymentsDir, lyraFileName)
  const addressesDir = path.join(__dirname, '../contracts/addresses')
  const lyraTargets = require(lyraFilePath).targets // eslint-disable-line
  console.log(lyraFilePath)

  console.log('- deployment:', deployment)

  const addressesFilePath = path.join(addressesDir, deployment + '.addresses.json')
  fs.removeSync(addressesFilePath)
  console.log('- removed:', addressesFilePath)
  console.log('- copying addresses:', LYRA_TARGETS.length)
  const addresses = LYRA_TARGETS.reduce((addresses, target) => {
    if (deployment === Deployment.Mainnet && target === LyraContractId.TestFaucet) {
      // Skip TestFaucet on Mainnet (not deployed)
      return addresses
    }
    return {
      ...addresses,
      [target]: lyraTargets[target].address,
    }
  }, {})
  fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2))
  console.log('-- copied', LYRA_TARGETS.join(', '))
}
