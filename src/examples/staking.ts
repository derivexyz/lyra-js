import getLyra from './utils/getLyra'

export default async function staking(argv: string[]) {
  const lyra = getLyra()
  const globalStakingData = await lyra.staking()
  console.log(globalStakingData)
}
