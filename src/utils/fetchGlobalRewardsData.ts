import { GlobalRewardEpoch } from '../reward_epoch'
import fetchURL from './fetchURL'

const URL = `https://api.lyra.finance/globalRewards`

export default async function fetchGlobalRewardsData(): Promise<GlobalRewardEpoch[]> {
  return (await fetchURL(URL)) ?? []
}
