import { Block } from '@ethersproject/providers'

import { Deployment, Market, MarketLiquiditySnapshot } from '..'
import { AccountRewardEpoch } from '../account_reward_epoch'
import { SECONDS_IN_DAY, SECONDS_IN_WEEK, SECONDS_IN_YEAR } from '../constants/time'
import Lyra from '../lyra'
import { LyraStaking } from '../lyra_staking'
import fetchGlobalRewardEpochData, { GlobalRewardEpochData } from '../utils/fetchGlobalRewardEpochData'
import fetchLyraTokenSpotPrice from '../utils/fetchLyraTokenSpotPrice'
import fetchOpTokenSpotPrice from '../utils/fetchOpTokenSpotPrice'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getEffectiveLiquidityTokens, { getMinimumStakedLyra } from '../utils/getEffectiveLiquidityTokens'
import getEffectiveTradingFeeRebate from '../utils/getEffectiveTradingFeeRebate'

export type GlobalRewardEpochTradingFeeRebateTier = {
  stakedLyraCutoff: number
  feeRebate: number
}

export type RewardEpochToken = {
  address: string
  symbol: string
  decimals: number
}

export type RewardEpochTokenAmount = {
  address: string
  symbol: string
  decimals: number
  amount: number
}

export type RewardEpochTokenConfig = RewardEpochToken & {
  amount: number
}

export class GlobalRewardEpoch {
  private lyra: Lyra
  private epoch: GlobalRewardEpochData
  id: number
  progressDays: number
  markets: Market[]
  marketsLiquidity: MarketLiquiditySnapshot[]
  staking: LyraStaking
  blockTimestamp: number
  startTimestamp: number
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
  stakingApy: RewardEpochTokenAmount[]
  totalStakingRewards: RewardEpochTokenAmount[]
  tradingRewardsCap: RewardEpochTokenAmount[]
  prices: RewardEpochTokenAmount[]
  tradingFeeRebateTiers: GlobalRewardEpochTradingFeeRebateTier[]
  wethLyraStaking: RewardEpochTokenAmount[]
  constructor(
    lyra: Lyra,
    id: number,
    epoch: GlobalRewardEpochData,
    prices: RewardEpochTokenAmount[],
    markets: Market[],
    marketsLiquidity: MarketLiquiditySnapshot[],
    staking: LyraStaking,
    block: Block
  ) {
    this.lyra = lyra
    this.id = id
    this.epoch = epoch
    this.prices = prices
    this.tradingFeeRebateTiers = epoch.tradingRewardConfig?.rebateRateTable?.map(tier => {
      return {
        stakedLyraCutoff: tier?.cutoff ?? 0,
        feeRebate: tier?.returnRate ?? 0,
      }
    })
    this.blockTimestamp = block.timestamp
    this.startTimestamp = epoch.startTimestamp
    this.lastUpdatedTimestamp = epoch.lastUpdated
    this.endTimestamp = epoch.endTimestamp
    this.isDepositPeriod = epoch.isDepositPeriod
    this.startEarningTimestamp = epoch.startEarningTimestamp
    this.isCurrent = this.blockTimestamp >= this.startTimestamp && this.blockTimestamp <= this.endTimestamp
    this.isComplete = this.blockTimestamp > this.endTimestamp
    this.markets = markets
    this.staking = staking
    this.marketsLiquidity = marketsLiquidity

    const durationSeconds = Math.max(0, this.endTimestamp - this.startTimestamp)
    this.duration = durationSeconds
    const progressSeconds = durationSeconds - Math.max(0, this.endTimestamp - this.blockTimestamp)
    this.progressDays = progressSeconds / SECONDS_IN_DAY
    this.totalAverageStakedLyra = this.progressDays ? epoch.totalStkLyraDays / this.progressDays : 0

    // Staking
    const stkLyraPrice =
      this.prices.find(token => ['lyra', 'stklyra'].includes(token.symbol.toLowerCase()))?.amount ?? 0 // TODO: @dillon refactor later
    const stkLyraPerDollar = stkLyraPrice > 0 ? 1 / stkLyraPrice : 0
    const totalStkLyra = this.isComplete ? this.totalAverageStakedLyra : fromBigNumber(staking.totalSupply)
    const pctSharePerDollar = totalStkLyra > 0 ? stkLyraPerDollar / totalStkLyra : 0

    this.stakingApy = this.epoch.stakingRewardConfig.map(tokenReward => {
      const rewardAmount = tokenReward.amount
      const perDollarPerSecond = durationSeconds > 0 ? (pctSharePerDollar * rewardAmount) / durationSeconds : 0
      const price = this.findTokenPrice(tokenReward.address)
      const apy = perDollarPerSecond * price * SECONDS_IN_YEAR
      return {
        address: tokenReward.address,
        symbol: tokenReward.symbol,
        decimals: tokenReward.decimals,
        amount: apy,
      }
    })

    this.totalStakingRewards = this.epoch.stakingRewardConfig.map(tokenReward => {
      return {
        address: tokenReward.address,
        symbol: tokenReward.symbol,
        decimals: tokenReward.decimals,
        amount: tokenReward.amount,
      }
    })

    this.minTradingFeeRebate = this.tradingFeeRebate(0)
    this.maxTradingFeeRebate = this.tradingFeeRebate(totalStkLyra)

    this.tradingRewardsCap = this.epoch.tradingRewardConfig.tokens.map(token => {
      return {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        amount: token.cap,
      }
    })

    this.wethLyraStaking = this.epoch?.wethLyraStakingRewardConfig ?? []
  }

  // Getters

  static async getAll(lyra: Lyra): Promise<GlobalRewardEpoch[]> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return []
    }
    const [epochs, lyraPrice, opPrice, markets, staking, block] = await Promise.all([
      fetchGlobalRewardEpochData(lyra),
      fetchLyraTokenSpotPrice(lyra),
      fetchOpTokenSpotPrice(lyra), // TODO: @dillon refactor later to map through tokens
      lyra.markets(),
      lyra.lyraStaking(),
      lyra.provider.getBlock('latest'),
    ])

    const marketsLiquidity = await Promise.all(markets.map(market => market.liquidity()))

    // TODO @dillon - come back think of better solution
    const prices: { [address: string]: RewardEpochTokenAmount } = {}
    epochs.forEach(epoch => {
      const stakingRewardTokens: RewardEpochToken[] =
        epoch?.globalStakingRewards.map(reward => {
          return {
            address: reward.address,
            decimals: reward.decimals,
            symbol: reward.symbol,
          }
        }) ?? []
      const mmvRewardTokens: RewardEpochToken[] = Object.values(epoch?.globalMMVRewards)
        .map(rewardTokens => {
          return rewardTokens.map(reward => {
            return {
              address: reward.address,
              decimals: reward.decimals,
              symbol: reward.symbol,
            }
          })
        })
        .flat()
      const tradingRewardTokens: RewardEpochToken[] =
        epoch.globalTradingRewards?.totalRewards?.map(reward => {
          return {
            address: reward.address,
            decimals: reward.decimals,
            symbol: reward.symbol,
          }
        }) ?? []
      const tokens = [...stakingRewardTokens, ...mmvRewardTokens, ...tradingRewardTokens]
      tokens.forEach(token => {
        if (['lyra', 'stklyra'].includes(token.symbol.toLowerCase())) {
          prices[token.address] = {
            amount: lyraPrice,
            address: token.address,
            decimals: token.decimals,
            symbol: token.symbol,
          }
        }
        if (['op'].includes(token.symbol.toLowerCase())) {
          prices[token.address] = {
            amount: opPrice,
            address: token.address,
            decimals: token.decimals,
            symbol: token.symbol,
          }
        }
      })
    })

    return epochs
      .map(
        (epoch, idx) =>
          new GlobalRewardEpoch(lyra, idx + 1, epoch, Object.values(prices), markets, marketsLiquidity, staking, block)
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
    _vaultTokenBalance: number
  ): RewardEpochTokenAmount[] {
    const market = findMarketX(this.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol

    const vaultTokenBalance = _vaultTokenBalance

    const totalAvgVaultTokens = this.totalAverageVaultTokens(marketAddressOrName)
    const mmvConfig = this.epoch.MMVConfig[marketKey]
    const scaledStkLyraDays = this.epoch.scaledStkLyraDays[marketKey]
    if (!mmvConfig) {
      return []
    }

    const x = mmvConfig.x
    const totalAvgScaledStkLyra = this.progressDays ? scaledStkLyraDays / this.progressDays : 0

    const effectiveLpTokensPerLpToken = getEffectiveLiquidityTokens(
      vaultTokenBalance,
      totalAvgVaultTokens,
      stakedLyraBalance,
      totalAvgScaledStkLyra,
      x
    )

    const totalAvgBoostedVaultTokens = this.totalAverageBoostedVaultTokens(marketAddressOrName)
    const boostedPortionOfLiquidity =
      totalAvgBoostedVaultTokens > 0 ? effectiveLpTokensPerLpToken / totalAvgBoostedVaultTokens : 0
    const basePortionOfLiquidity = totalAvgVaultTokens > 0 ? vaultTokenBalance / totalAvgVaultTokens : 0

    // This ratio is for no staking -> staking w/ stkLyraBalance (noStakingMultiplier)
    // Vs UI apy multiplier is from zero staking -> staking w/ stkLyraBalance (vaultApyMultiplier)
    const apyMultiplier = basePortionOfLiquidity > 0 ? boostedPortionOfLiquidity / basePortionOfLiquidity : 0

    // Calculate total vault token balance, including pending deposits
    const marketIdx = this.markets.findIndex(m => m.address === market.address)
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
    this.epoch.globalMMVRewards[marketKey]
    return this.epoch.globalMMVRewards[marketKey]
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
    return this.epoch.tradingRewardConfig.tokens.map(token => {
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
  }

  shortCollateralRewards(shortCollateralRebate: number): RewardEpochTokenAmount[] {
    return this.epoch.tradingRewardConfig.tokens.map(token => {
      const currentPrice = this.findTokenPrice(token.address)
      const price = this.isComplete ? token.fixedPrice : Math.max(currentPrice, token.floorTokenPrice)
      const rewardAmount = (shortCollateralRebate * token.portion) / price
      return {
        amount: rewardAmount,
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    })
  }

  shortCollateralYieldPerDay(
    contracts: number,
    delta: number,
    expiryTimestamp: number,
    marketBaseSymbol: string
  ): RewardEpochTokenAmount[] {
    const timeToExpiry = Math.max(0, expiryTimestamp - this.blockTimestamp)
    const absDelta = Math.abs(delta)
    if (
      !this.epoch.tradingRewardConfig.shortCollateralRewards ||
      !this.epoch.tradingRewardConfig.shortCollateralRewards[marketBaseSymbol] ||
      absDelta < 0.1 ||
      absDelta > 0.9 ||
      this.isComplete
    ) {
      return []
    }

    const { longDatedPenalty, tenDeltaRebatePerOptionDay, ninetyDeltaRebatePerOptionDay } =
      this.epoch.tradingRewardConfig.shortCollateralRewards[marketBaseSymbol]
    const timeDiscount = timeToExpiry >= SECONDS_IN_WEEK * 4 ? longDatedPenalty : 1

    const rebatePerDay =
      (tenDeltaRebatePerOptionDay +
        (ninetyDeltaRebatePerOptionDay - tenDeltaRebatePerOptionDay) *
          ((absDelta - 0.1) / (0.9 - 0.1)) *
          timeDiscount) *
      contracts

    return this.epoch.tradingRewardConfig.tokens.map(token => {
      const currentPrice = this.findTokenPrice(token.address)
      const price = Math.max(currentPrice, token.floorTokenPrice)
      const tokenRebatePerDay = token.portion * rebatePerDay
      const rewardAmount = price > 0 ? tokenRebatePerDay / price : 0
      return {
        amount: rewardAmount,
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    })
  }

  findTokenPrice(address: string): number {
    return this.prices.find(tokenPrice => tokenPrice.address.toLowerCase() === address.toLowerCase())?.amount ?? 0
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
