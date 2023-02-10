import { LYRA_API_URL } from '../constants/links'
import { RewardEpochToken, RewardEpochTokenAmount, RewardEpochTokenConfig } from '../global_reward_epoch'
import Lyra, { Deployment } from '../lyra'
import fetchWithCache from './fetchWithCache'

export type GlobalRewardEpochData = {
  deployment: Deployment // indexed
  startTimestamp: number // indexed
  startEarningTimestamp?: number
  endTimestamp: number
  isDepositPeriod?: boolean
  lastUpdated: number
  totalStkLyraDays: number
  scaledStkLyraDays: {
    [market: string]: number
  }
  totalLpTokenDays: {
    [market: string]: number
  }
  totalBoostedLpTokenDays: {
    [market: string]: number
  }
  globalStakingRewards: RewardEpochTokenAmount[]
  globalMMVRewards: {
    [market: string]: RewardEpochTokenAmount[]
  }
  globalTradingRewards: GlobalTradingRewards
  tradingRewardConfig: GlobalTradingRewardsConfig
  MMVConfig: GlobalMMVConfig
  stakingRewardConfig: GlobalStakingConfig
  wethLyraStakingL2RewardConfig?: GlobalArrakisConfig
}

export type GlobalTradingRewards = {
  totalRewards: RewardEpochTokenAmount[]
  totalFees: number
  totalTradingRebateRewards: RewardEpochTokenAmount[]
  totalShortCollateralRewards: RewardEpochTokenAmount[]
  totalShortCallSeconds: number
  totalShortPutSeconds: number
  scaleFactors: RewardEpochTokenAmount[]
}

export type GlobalTradingRewardsConfig = {
  useRebateTable: boolean
  rebateRateTable: { cutoff: number; returnRate: number }[]
  maxRebatePercentage: number
  netVerticalStretch: number // param a // netVerticalStretch
  verticalShift: number // param b // verticalShift
  vertIntercept: number // param c // minReward // vertIntercept
  stretchiness: number // param d // stretchiness
  tokens: GlobalTradingRewardsRewardEpochTokenConfig[]
  shortCollateralRewards: {
    [market: string]: {
      tenDeltaRebatePerOptionDay: number
      ninetyDeltaRebatePerOptionDay: number
      longDatedPenalty: number
    }
  }
}

export type GlobalMMVConfig = {
  [market: string]: {
    tokens: RewardEpochTokenConfig[]
    x: number
    totalStkScaleFactor: number
    ignoreList: string[]
  }
}

type GlobalTradingRewardsRewardEpochTokenConfig = RewardEpochToken & {
  cap: number
  floorTokenPrice: number
  fixedPrice: number
  portion: number
}

export type GlobalStakingConfig = RewardEpochTokenConfig[]

export type GlobalArrakisConfig = RewardEpochTokenConfig[]

export default async function fetchGlobalRewardEpochData(lyra: Lyra): Promise<GlobalRewardEpochData[]> {
  if (lyra.deployment !== Deployment.Mainnet) {
    return []
  }
  return fetchWithCache(`${LYRA_API_URL}/rewards/global?network=${lyra.network}`)
}
