import fs from 'fs-extra'
import path from 'path'
import { glob, runTypeChain } from 'typechain'
import yargs from 'yargs/yargs'

import { Deployment, LyraContractId, LyraMarketContractId } from '../constants/contracts'
import getLyraDeploymentDirectory from '../utils/getLyraDeploymentDirectory'
import getLyraDeploymentFileName from '../utils/getLyraDeploymentFileName'

const LYRA_TARGETS = [
  LyraContractId.OptionMarketViewer,
  LyraContractId.OptionMarketWrapper,
  LyraContractId.SynthetixAdapter,
  LyraContractId.TestFaucet,
  LyraContractId.LyraRegistry,
  LyraMarketContractId.OptionMarket,
  LyraMarketContractId.OptionMarketPricer,
  LyraMarketContractId.OptionToken,
  LyraMarketContractId.ShortCollateral,
  LyraMarketContractId.OptionGreekCache,
  LyraMarketContractId.LiquidityToken,
  LyraMarketContractId.LiquidityPool,
  LyraMarketContractId.ShortPoolHedger,
]

export default async function syncABIs(_argv: string[]): Promise<void> {
  console.log('sync abis')
  const argv = await yargs(_argv).options({
    deployment: { choices: Object.values(Deployment), demandOption: true, alias: 'd' },
  }).argv
  const deployment: Deployment = argv.deployment as unknown as Deployment
  const deploymentsDir = path.join(__dirname, '../../../../lyra/deployments', getLyraDeploymentDirectory(deployment))
  const lyraFileName = getLyraDeploymentFileName(deployment)
  const lyraFilePath = path.join(deploymentsDir, lyraFileName)
  const abisDir = path.join(__dirname, '../contracts/abis')
  const typechainDir = path.join(__dirname, '../contracts/typechain')
  const lyraSources = require(lyraFilePath).sources // eslint-disable-line

  console.log('- deployment:', deployment)

  console.log('- copying abis:', LYRA_TARGETS.length)
  LYRA_TARGETS.forEach(target => {
    if (deployment === Deployment.Mainnet && target === LyraContractId.TestFaucet) {
      // Skip TestFaucet on Mainnet (not deployed)
      return
    }
    console.log(target)
    fs.writeFileSync(path.join(abisDir, target) + '.json', JSON.stringify(lyraSources[target].abi, null, 2))
    console.log('-- copied', target)
  })

  console.log('- generating typechain')
  fs.emptyDirSync(typechainDir)
  const cwd = process.cwd()
  const allFiles = glob(cwd, [`${abisDir}/**/+([a-zA-Z0-9_]).json`])
  await runTypeChain({
    cwd,
    filesToProcess: allFiles,
    allFiles,
    outDir: typechainDir,
    target: 'ethers-v5',
  })
}
