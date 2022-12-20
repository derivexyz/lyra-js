import { glob, runTypeChain } from 'typechain'

export default async function main() {
  const cwd = process.cwd()
  // find all files matching the glob
  const allFiles = glob(cwd, [`src/contracts/**/abis/+([a-zA-Z0-9_]).json`])
  const deploymentFiles = allFiles.reduce((deployments, file) => {
    const deployment = file.split('/abis')[0]
    const deploymentFiles = deployments[deployment] ?? []
    return {
      ...deployments,
      [deployment]: deploymentFiles.concat(file),
    }
  }, {} as Record<string, Array<string>>)
  await Promise.all(
    Object.entries(deploymentFiles).map(([deployment, files]) => {
      console.log({ files, deployment })
      runTypeChain({
        cwd,
        filesToProcess: files,
        allFiles: files,
        outDir: `${deployment}/typechain`,
        target: 'ethers-v5',
      })
    })
  )
}

main().catch(console.error)
