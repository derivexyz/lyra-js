import getLyra from './utils/getLyra'

export default async function staking() {
  const lyra = getLyra()
  const globalStakingData = await lyra.lyraStaking()
  console.log(globalStakingData)
}
