import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'
import fetchAccountRewardsData from '../utils/fetchAccountRewardsData'
import fetchGlobalRewardsData from '../utils/fetchGlobalRewardsData'
import toBigNumber from '../utils/toBigNumber'

export type AccountRewardEpoch = {
  _id: string
  account: string
  startTimestamp: number
  endTimestamp: number
  stkLyraDays: number
  inflationaryRewards: number
  lpDays: Record<string, number>
  boostedLpDays: Record<string, number>
  lpRewards: Record<string, number>
  tradingFees: number
  feeRebate: number
  tradingRewards: number
}

export type GlobalRewardEpoch = {
  _id: string
  startTimestamp: number
  endTimestamp: number
  totalStkLyraDays: number
  totalLpTokenDays: Record<string, number>
  tradingRewardsCap: number
  totalInflationaryRewards: number
  totalLpRewards: Record<string, number>
  a: number
  b: number
  c: number
  d: number
  x: number
}

type RewardsEpochMap = {
  [key: string]: {
    global?: GlobalRewardEpoch
    account?: AccountRewardEpoch
  }
}

export class RewardEpoch {
  lyra: Lyra
  account: string
  startTimestamp: number
  endTimestamp: number
  totalRewards: BigNumber
  inflationaryRewards: BigNumber
  tradingRewards: BigNumber
  tradingFees: BigNumber
  feeRebate: BigNumber
  totalVaultRewards: BigNumber
  constructor(lyra: Lyra, account: string, globalData: GlobalRewardEpoch, accountData: AccountRewardEpoch) {
    // Data
    this.lyra = lyra
    this.account = account
    this.startTimestamp = globalData.startTimestamp
    this.endTimestamp = globalData.endTimestamp
    this.inflationaryRewards = toBigNumber(accountData.inflationaryRewards)
    this.tradingRewards = toBigNumber(accountData.tradingRewards)
    this.tradingFees = toBigNumber(accountData.tradingFees)
    this.feeRebate = toBigNumber(accountData.feeRebate)
    this.totalVaultRewards = Object.values(accountData.lpRewards).reduce(
      (total, reward) => total.add(toBigNumber(reward)),
      ZERO_BN
    )
    this.totalRewards = this.inflationaryRewards.add(this.tradingRewards).add(this.totalVaultRewards)
  }

  // Getters

  static async getByOwner(lyra: Lyra, account: string): Promise<RewardEpoch[]> {
    const globalRewardsApiData = await fetchGlobalRewardsData()
    const accountRewardsApiData = await fetchAccountRewardsData(account)
    const rewardsEpochMap: RewardsEpochMap = {}
    const rewardEpochs: RewardEpoch[] = []
    globalRewardsApiData.reduce((map, globalRewardEpoch) => {
      if (!map[globalRewardEpoch.endTimestamp]) {
        map[globalRewardEpoch.endTimestamp] = {}
      }
      map[globalRewardEpoch.endTimestamp].global = globalRewardEpoch
      return map
    }, rewardsEpochMap)
    accountRewardsApiData.reduce((map, accountRewardEpoch) => {
      if (!map[accountRewardEpoch.endTimestamp]) {
        map[accountRewardEpoch.endTimestamp] = {}
      }
      map[accountRewardEpoch.endTimestamp].account = accountRewardEpoch
      return map
    }, rewardsEpochMap)

    for (const epochTimestamp in rewardsEpochMap) {
      const globalData = rewardsEpochMap[epochTimestamp].global
      const accountData = rewardsEpochMap[epochTimestamp].account
      if (globalData && accountData) {
        const rewardEpoch = new RewardEpoch(lyra, account, globalData, accountData)
        rewardEpochs.push(rewardEpoch)
      }
    }
    return rewardEpochs
  }

  static async getLatestRewardEpochByOwner(lyra: Lyra, account: string): Promise<RewardEpoch> {
    const rewardEpochs = await this.getByOwner(lyra, account)
    const latestRewardEpoch = rewardEpochs.sort((a, b) => b.endTimestamp - a.endTimestamp)[0]
    return latestRewardEpoch
  }

  static async vaultRewards(marketAddressOrName: string): Promise<BigNumber> {
    const globalRewardsApiData = await fetchGlobalRewardsData()
    return ZERO_BN
  }
}
