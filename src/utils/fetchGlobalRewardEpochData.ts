import Lyra, { Deployment } from '../lyra'
import fetchURL from './fetchURL'

const GLOBAL_URL = '/stake/globalRewards'
const GLOBAL_EPOCH_CACHE_LIFE = 60
const GLOBAL_EPOCH_CACHE: { lastUpdated: number; epochs: Promise<GlobalRewardEpochData[]> | null } = {
  lastUpdated: 0,
  epochs: null,
}

export type TradingRewardsConfig = {
  maxRebatePercentage: number
  netVerticalStretch: number // param a // netVerticalStretch
  verticalShift: number // param b // verticalShift
  vertIntercept: number // param c // minReward // vertIntercept
  stretchiness: number // param d // stretchiness
  rewards: {
    lyraRewardsCap: number
    opRewardsCap: number
    floorTokenPriceOP: number
    floorTokenPriceLyra: number
    lyraPortion: number // % split of rebates in stkLyra vs OP (in dollar terms)
    fixedLyraPrice: number // override market rate after epoch is over, if 0 just use market rate
    fixedOpPrice: number
  }
}

export type GlobalRewardEpochData = {
  deployment: string // indexed
  startTimestamp: number // indexed
  endTimestamp: number
  lastUpdated: number
  totalStkLyraDays: number
  scaledStkLyraDays: Record<string, number>
  stkLyraDaysPerLPMarket: Record<string, number>
  totalLpTokenDays: Record<string, number>
  totalBoostedLpTokenDays: Record<string, number>
  rewardedStakingRewards: {
    lyra: number
    op: number
  }
  rewardedMMVRewards: {
    LYRA: Record<string, number>
    OP: Record<string, number>
  }
  rewardedTradingRewards: Record<string, number>
  tradingRewardConfig: TradingRewardsConfig
  MMVConfig: Record<
    string,
    {
      LYRA: number
      OP: number
      x: number
      ignoreList: string[]
      totalStkScaleFactor: number
    }
  >
  stakingRewardConfig: {
    totalRewards: {
      LYRA: number
      OP: number
    }
  }
}

export default async function fetchGlobalRewardEpochData(
  lyra: Lyra,
  blockTimestamp: number
): Promise<GlobalRewardEpochData[]> {
  if (blockTimestamp > GLOBAL_EPOCH_CACHE.lastUpdated + GLOBAL_EPOCH_CACHE_LIFE || !GLOBAL_EPOCH_CACHE.epochs) {
    GLOBAL_EPOCH_CACHE.epochs = fetchURL<GlobalRewardEpochData[]>(
      `${lyra.apiUri}${GLOBAL_URL}?deployment=${
        lyra.deployment === Deployment.Kovan ? 'kovan-ovm-avalon' : 'mainnet-ovm-avalon'
      }`
    )
    GLOBAL_EPOCH_CACHE.lastUpdated = blockTimestamp
  }
  return GLOBAL_EPOCH_CACHE.epochs
}
