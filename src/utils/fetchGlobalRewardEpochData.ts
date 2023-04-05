import {
  RewardEpochToken,
  RewardEpochTokenAmount,
  RewardEpochTokenConfig,
  RewardEpochTokenPrice,
} from '../global_reward_epoch'
import Lyra, { Deployment } from '../lyra'
import fetchWithCache from './fetchWithCache'

export type GlobalRewardEpochData = {
  deployment: Deployment // indexed
  startTimestamp: number // indexed
  startEarningTimestamp?: number
  endTimestamp: number
  distributionTimestamp: number
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
  tokenPrices?: RewardEpochTokenPrice[]
}

export type GlobalTradingRewards = {
  totalRewards?: RewardEpochTokenAmount[]
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

const EMPTY: GlobalRewardEpochData[] = []

export default async function fetchGlobalRewardEpochData(lyra: Lyra): Promise<GlobalRewardEpochData[]> {
  if (lyra.deployment !== Deployment.Mainnet) {
    return EMPTY
  }
  return fetchWithCache(`${lyra.apiUri}/rewards/global?network=${lyra.network}`)
}
