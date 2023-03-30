import getLyra from './utils/getLyra'

export default async function rewardEpoch() {
  const lyra = getLyra()
  const epoch = await lyra.latestGlobalRewardEpoch()
  const minVaultApy = epoch?.minVaultApy('eth')
  const maxVaultApy = epoch?.maxVaultApy('eth')
  console.log('Global', { minVaultApy, maxVaultApy })
}
