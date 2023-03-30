import { RewardEpochTokenAmount } from '../global_reward_epoch'
import Lyra, { Deployment } from '../lyra'
import fetchWithCache from './fetchWithCache'

export type AccountRewardEpochData = {
  account: string // indexed,
  deployment: Deployment // indexed
  startTimestamp: number // indexed
  endTimestamp: number
  lastUpdated: number
  stakingRewards: AccountStakingRewards
  mmvRewards: AccountMMVRewards
  tradingRewards: AccountTradingRewards
  integratorTradingRewards?: AccountTradingRewards
}

export type AccountStakingRewards = {
  isIgnored: boolean
  rewards: RewardEpochTokenAmount[]
  stkLyraDays: number
}

export type AccountMMVRewards = {
  [market: string]: {
    lpDays: number
    boostedLpDays: number
    rewards: RewardEpochTokenAmount[]
    isIgnored: boolean
  }
}

export type AccountTradingRewards = {
  fees: number
  effectiveRebateRate: number
  tradingRebateRewardDollars: number
  totalTradingRewardDollars: number
  shortCallSeconds: number
  shortPutSeconds: number
  rewards: {
    trading: RewardEpochTokenAmount[]
  }
}

export default async function fetchAccountRewardEpochData(
  lyra: Lyra,
  account: string
): Promise<AccountRewardEpochData[]> {
  if (lyra.deployment !== Deployment.Mainnet) {
    return []
  }
  return fetchWithCache(`${lyra.apiUri}/rewards/account?network=${lyra.network}&account=${account}`)
}
