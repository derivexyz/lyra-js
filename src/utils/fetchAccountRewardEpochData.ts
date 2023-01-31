import { LYRA_API_URL } from '../constants/links'
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
  arrakisRewards?: AccountArrakisRewards
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
  shortCollateralRewardDollars: number
  totalTradingRewardDollars: number
  shortCallSeconds: number
  shortPutSeconds: number
  rewards: {
    trading: RewardEpochTokenAmount[]
    shortCollateral: RewardEpochTokenAmount[]
  }
}

export type AccountArrakisRewards = {
  rewards: RewardEpochTokenAmount[]
  gUniTokensStaked: number
  percentShare: number
}

export default async function fetchAccountRewardEpochData(
  lyra: Lyra,
  account: string
): Promise<AccountRewardEpochData[]> {
  if (lyra.deployment !== Deployment.Mainnet) {
    return []
  }
  return fetchWithCache(`${LYRA_API_URL}/rewards/account?network=${lyra.network}&account=${account}`)
}
