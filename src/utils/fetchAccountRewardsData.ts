import { AccountRewardEpoch } from '../reward_epoch'
import fetchURL from './fetchURL'

const URL = `https://api.lyra.finance/accountRewards`

export default async function fetchAccountRewardsData(account: string): Promise<AccountRewardEpoch[]> {
  return (await fetchURL(`${URL}?account=${account}`)) ?? []
}
