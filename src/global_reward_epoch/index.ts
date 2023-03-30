import { Block } from '@ethersproject/providers'

import { Deployment, Market, MarketLiquiditySnapshot, Network, OP_OPTIMISM_MAINNET_ADDRESS } from '..'
import { AccountRewardEpoch } from '../account_reward_epoch'
import { SECONDS_IN_DAY, SECONDS_IN_YEAR } from '../constants/time'
import Lyra from '../lyra'
import fetchGlobalRewardEpochData, { GlobalRewardEpochData } from '../utils/fetchGlobalRewardEpochData'
import fetchLyraPrice from '../utils/fetchLyraPrice'
import fetchLyraStakingParams, { LyraStakingParams } from '../utils/fetchLyraStakingParams'
import fetchTokenSpotPrice from '../utils/fetchTokenSpotPrice'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getEffectiveLiquidityTokens, { getMinimumStakedLyra } from '../utils/getEffectiveLiquidityTokens'
import getEffectiveTradingFeeRebate from '../utils/getEffectiveTradingFeeRebate'
import getUniqueBy from '../utils/getUniqueBy'
import isMarketEqual from '../utils/isMarketEqual'
import getEpochRewardTokenPrices from './getEpochRewardTokenPrices'

export type GlobalRewardEpochTradingFeeRebateTier = {
  stakedLyraCutoff: number
  feeRebate: number
}

export type RewardEpochToken = {
  address: string
  symbol: string
  decimals: number
}

export type RewardEpochTokenAmount = RewardEpochToken & {
  amount: number
}

export type RewardTokenPrices = {
  lyraPrice: number
  opPrice: number
}

export type RewardEpochTokenPriceMap = {
  [address: string]: RewardEpochToken & { price: number }
}

export type RewardEpochTokenConfig = RewardEpochToken & {
  amount: number
}

export class GlobalRewardEpoch {
  lyra: Lyra
  epoch: GlobalRewardEpochData
  id: number
  progressDays: number
  markets: Market[]
  marketsLiquidity: MarketLiquiditySnapshot[]
  stakingParams: LyraStakingParams
  blockTimestamp: number
  startTimestamp: number
  distributionTimestamp: number
  startEarningTimestamp?: number
  endTimestamp: number
  isDepositPeriod?: boolean
  duration: number
  lastUpdatedTimestamp: number
  isCurrent: boolean
  isComplete: boolean
  totalAverageStakedLyra: number
  minTradingFeeRebate: number
  maxTradingFeeRebate: number
  tradingRewardsCap: RewardEpochTokenAmount[]
  prices: RewardEpochTokenPriceMap
  tradingFeeRebateTiers: GlobalRewardEpochTradingFeeRebateTier[]
  vaultRewardTokens: RewardEpochToken[]
  tradingRewardTokens: RewardEpochToken[]
  rewardTokens: RewardEpochToken[]
  constructor(
    lyra: Lyra,
    id: number,
    epoch: GlobalRewardEpochData,
    prices: RewardTokenPrices,
    markets: Market[],
    marketsLiquidity: MarketLiquiditySnapshot[],
    stakingParams: LyraStakingParams,
    block: Block
  ) {
    this.lyra = lyra
    this.id = id
    this.epoch = epoch
    this.markets = markets
    this.stakingParams = stakingParams
    this.marketsLiquidity = marketsLiquidity
    this.prices = getEpochRewardTokenPrices(epoch, prices)
    this.tradingFeeRebateTiers = epoch.tradingRewardConfig?.rebateRateTable?.map(tier => ({
      stakedLyraCutoff: tier.cutoff,
      feeRebate: tier.returnRate,
    }))

    this.blockTimestamp = block.timestamp
    this.startTimestamp = epoch.startTimestamp
    this.lastUpdatedTimestamp = epoch.lastUpdated
    this.endTimestamp = epoch.endTimestamp
    this.distributionTimestamp = epoch.distributionTimestamp ?? epoch.endTimestamp
    this.isDepositPeriod = epoch.isDepositPeriod
    this.startEarningTimestamp = epoch.startEarningTimestamp
    this.isCurrent = this.blockTimestamp >= this.startTimestamp && this.blockTimestamp <= this.endTimestamp
    this.isComplete = this.blockTimestamp > this.endTimestamp

    const durationSeconds = Math.max(0, this.endTimestamp - this.startTimestamp)
    const progressSeconds = durationSeconds - Math.max(0, this.endTimestamp - this.blockTimestamp)
    this.duration = durationSeconds
    this.progressDays = progressSeconds / SECONDS_IN_DAY
    this.totalAverageStakedLyra = this.progressDays ? epoch.totalStkLyraDays / this.progressDays : 0

    // Trading
    const totalStkLyra = this.isComplete ? this.totalAverageStakedLyra : fromBigNumber(stakingParams.totalSupply)
    this.minTradingFeeRebate = this.tradingFeeRebate(0)
    this.maxTradingFeeRebate = this.tradingFeeRebate(totalStkLyra)
    this.tradingRewardsCap = epoch.tradingRewardConfig.tokens.map(token => ({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      amount: token.cap,
    }))

    this.tradingRewardTokens = getUniqueBy(
      epoch.tradingRewardConfig.tokens.filter(t => t.cap > 0),
      token => token.address.toLowerCase()
    )

    this.vaultRewardTokens = getUniqueBy(
      Object.values(epoch.MMVConfig)
        .flatMap(e => e.tokens)
        .filter(t => t.amount > 0),
      token => token.address.toLowerCase()
    )

    this.rewardTokens = getUniqueBy([...this.tradingRewardTokens, ...this.vaultRewardTokens], r => r.address)
  }

  // Getters

  static async getAll(lyra: Lyra): Promise<GlobalRewardEpoch[]> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return []
    }

    const [epochs, lyraPrice, opPrice, stakingParams, markets, block] = await Promise.all([
      fetchGlobalRewardEpochData(lyra),
      fetchLyraPrice(lyra),
      fetchTokenSpotPrice(lyra, OP_OPTIMISM_MAINNET_ADDRESS, Network.Optimism),
      fetchLyraStakingParams(lyra),
      lyra.markets(),
      lyra.provider.getBlock('latest'),
    ])
    const marketsLiquidity = await Promise.all(markets.map(market => market.liquidity()))

    return epochs
      .map(
        (epoch, idx) =>
          new GlobalRewardEpoch(
            lyra,
            idx + 1,
            epoch,
            { lyraPrice, opPrice },
            markets,
            marketsLiquidity,
            stakingParams,
            block
          )
      )
      .sort((a, b) => a.endTimestamp - b.endTimestamp)
  }

  static async getLatest(lyra: Lyra): Promise<GlobalRewardEpoch | null> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return null
    }
    const epochs = await this.getAll(lyra)
    const latestEpoch = epochs.find(r => !r.isComplete) ?? epochs[epochs.length - 1]
    return latestEpoch ?? null
  }

  static async getByStartTimestamp(lyra: Lyra, startTimestamp: number): Promise<GlobalRewardEpoch | null> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return null
    }
    const epochs = await this.getAll(lyra)
    const epoch = epochs.find(epoch => epoch.startTimestamp === startTimestamp)
    return epoch ?? null
  }

  // Dynamic Fields

  vaultApy(
    marketAddressOrName: string,
    stakedLyraBalance: number,
    vaultTokenBalance: number
  ): RewardEpochTokenAmount[] {
    const marketIdx = this.markets.findIndex(m => isMarketEqual(m, marketAddressOrName))
    const market = this.markets[marketIdx]
    const marketKey = market.baseToken.symbol

    const totalAvgVaultTokens = this.totalAverageVaultTokens(marketAddressOrName)
    const mmvConfig = this.epoch.MMVConfig[marketKey]
    const scaledStkLyraDays = this.epoch.scaledStkLyraDays[marketKey]
    if (!mmvConfig) {
      return []
    }

    const totalAvgScaledStkLyra = this.progressDays ? scaledStkLyraDays / this.progressDays : 0

    const effectiveLpTokensPerLpToken = getEffectiveLiquidityTokens(
      vaultTokenBalance,
      totalAvgVaultTokens,
      stakedLyraBalance,
      totalAvgScaledStkLyra,
      mmvConfig.x
    )
    const totalAvgBoostedVaultTokens = this.totalAverageBoostedVaultTokens(marketAddressOrName)
    const boostedPortionOfLiquidity =
      totalAvgBoostedVaultTokens > 0 ? effectiveLpTokensPerLpToken / totalAvgBoostedVaultTokens : 0
    const basePortionOfLiquidity = totalAvgVaultTokens > 0 ? vaultTokenBalance / totalAvgVaultTokens : 0

    // This ratio is for no staking -> staking w/ stkLyraBalance (noStakingMultiplier)
    // Vs UI apy multiplier is from zero staking -> staking w/ stkLyraBalance (vaultApyMultiplier)
    const apyMultiplier = basePortionOfLiquidity > 0 ? boostedPortionOfLiquidity / basePortionOfLiquidity : 0

    // Calculate total vault token balance, including pending deposits
    const tokenPrice = fromBigNumber(this.marketsLiquidity[marketIdx].tokenPrice)
    const totalQueuedVaultTokens =
      tokenPrice > 0 ? fromBigNumber(this.marketsLiquidity[marketIdx].pendingDeposits) / tokenPrice : 0
    const totalAvgAndQueuedVaultTokens = totalAvgVaultTokens + totalQueuedVaultTokens
    const vaultTokensPerDollar = tokenPrice > 0 ? 1 / tokenPrice : 0
    const pctSharePerDollar = totalAvgAndQueuedVaultTokens > 0 ? vaultTokensPerDollar / totalAvgAndQueuedVaultTokens : 0

    return mmvConfig.tokens.map(token => {
      const rewards = token.amount
      const perDollarPerSecond = this.duration > 0 ? (pctSharePerDollar * rewards) / this.duration : 0
      const price = this.findTokenPrice(token.address)
      const apy = perDollarPerSecond * price * SECONDS_IN_YEAR * apyMultiplier
      return {
        amount: apy,
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    })
  }

  vaultApyTotal(marketAddressOrName: string, stakedLyraBalance: number, _vaultTokenBalance: number): number {
    return this.vaultApy(marketAddressOrName, stakedLyraBalance, _vaultTokenBalance).reduce(
      (total, apy) => total + apy.amount,
      0
    )
  }

  vaultMaxBoost(marketAddressOrName: string, vaultTokenBalance: number): number {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const totalAvgVaultTokens = this.totalAverageVaultTokens(marketAddressOrName)
    const scaledStkLyraDays = this.epoch.scaledStkLyraDays[marketKey]
    const totalAvgScaledStkLyra = this.progressDays ? scaledStkLyraDays / this.progressDays : 0
    return getMinimumStakedLyra(totalAvgScaledStkLyra, vaultTokenBalance, totalAvgVaultTokens)
  }

  vaultApyMultiplier(marketAddressOrName: string, stakedLyraBalance: number, vaultTokenBalance: number): number {
    const baseApy = this.vaultApyTotal(marketAddressOrName, 0, vaultTokenBalance)
    const boostedApy = this.vaultApyTotal(marketAddressOrName, stakedLyraBalance, vaultTokenBalance)
    return baseApy > 0 ? boostedApy / baseApy : 0
  }

  minVaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    return this.vaultApy(marketAddressOrName, 0, 10_000)
  }

  maxVaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const scaledStkLyraDays = this.epoch.scaledStkLyraDays[marketKey]
    if (!scaledStkLyraDays) {
      return []
    }
    const totalAvgScaledStkLyra = this.progressDays ? scaledStkLyraDays / this.progressDays : 0
    return this.vaultApy(marketAddressOrName, totalAvgScaledStkLyra, 10_000)
  }

  totalVaultRewards(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    return this.epoch.globalMMVRewards[marketKey] ?? []
  }

  totalAverageVaultTokens(marketAddressOrName: string): number {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    return this.progressDays ? (this.epoch.totalLpTokenDays[marketKey] ?? 0) / this.progressDays : 0
  }

  totalAverageBoostedVaultTokens(marketAddressOrName: string): number {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    return this.progressDays ? (this.epoch.totalBoostedLpTokenDays[marketKey] ?? 0) / this.progressDays : 0
  }

  tradingFeeRebate(stakedLyraBalance: number): number {
    const {
      useRebateTable,
      rebateRateTable,
      maxRebatePercentage,
      netVerticalStretch,
      verticalShift,
      vertIntercept,
      stretchiness,
    } = this.epoch.tradingRewardConfig
    return getEffectiveTradingFeeRebate(
      stakedLyraBalance,
      useRebateTable,
      rebateRateTable,
      maxRebatePercentage,
      netVerticalStretch,
      verticalShift,
      vertIntercept,
      stretchiness
    )
  }

  tradingRewards(tradingFees: number, stakedLyraBalance: number): RewardEpochTokenAmount[] {
    return this.epoch.tradingRewardConfig.tokens
      .map(token => {
        const currentPrice = this.findTokenPrice(token.address)
        const price = this.isComplete ? token.fixedPrice : Math.max(currentPrice, token.floorTokenPrice)
        const feeRebate = this.tradingFeeRebate(stakedLyraBalance)
        const feesRebated = feeRebate * tradingFees
        const rewardAmount = (feesRebated * token.portion) / price
        return {
          amount: rewardAmount,
          address: token.address,
          decimals: token.decimals,
          symbol: token.symbol,
        }
      })
      .filter(e => e.amount > 0.0001)
  }

  private findTokenPrice(address: string): number {
    return this.prices[address]?.price ?? 0
  }

  // Edge

  async accountRewardEpoch(address: string): Promise<AccountRewardEpoch | null> {
    const epochs = await AccountRewardEpoch.getByOwner(this.lyra, address)
    const epoch = epochs.find(
      epoch =>
        epoch.globalEpoch.startTimestamp === this.startTimestamp && epoch.globalEpoch.endTimestamp === this.endTimestamp
    )
    return epoch ?? null
  }
}
