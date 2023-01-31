import { AccountRewardEpoch } from '..'
import getLyra from './utils/getLyra'

export default async function vaultApy() {
  const lyra = getLyra()
  const epoch = await AccountRewardEpoch.getByOwner(lyra, '')

  // const apy = epoch[0].vaultApy('ETH').total
  // const apyMultiplier = epoch[0].vaultApyMultiplier('ETH')
  // const minApy = epoch[0].globalEpoch.minVaultApy('ETH').total
  // const maxApy = epoch[0].globalEpoch.maxVaultApy('ETH').total

  // console.log('result', { apy, minApy, maxApy, apyMultiplier })
}
