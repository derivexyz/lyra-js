import { BigNumber } from 'ethers'

import { AccountLiquidityTokenBalance } from '../account'
import { LyraContractId } from '../constants/contracts'
import { SECONDS_IN_SIX_MONTHS } from '../constants/time'
import { GlobalRewardEpoch } from '../global_reward_epoch'
import Lyra from '../lyra'
import fetchAccountRewardEpochData, { AccountRewardEpochData } from '../utils/fetchAccountRewardEpochData'
import findMarket from '../utils/findMarket'
import fromBigNumber from '../utils/fromBigNumber'
import getLyraContract from '../utils/getLyraContract'
import getClaimAddedTags from '../utils/getRewardsClaimAddedTags'

export type AccountRewardEpochAPY = {
  lyra: number
  op: number
  total: number
}

export type AccountRewardEpochTokens = {
  lyra: number
  op: number
}

export class AccountRewardEpoch {
  private lyra: Lyra
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  account: string
  globalEpoch: GlobalRewardEpoch
  accountEpoch: AccountRewardEpochData
  stakedLyraBalance: number
  tradingFeeRebate: number
  tradingFees: number
  stakingRewards: AccountRewardEpochTokens
  isPendingRewards: boolean
  stakingRewardsUnlockTimestamp: AccountRewardEpochTokens
  totalVaultRewards: AccountRewardEpochTokens
  tradingRewards: AccountRewardEpochTokens
  constructor(
    lyra: Lyra,
    account: string,
    accountEpoch: AccountRewardEpochData,
    globalEpoch: GlobalRewardEpoch,
    vaultTokenBalances: AccountLiquidityTokenBalance[],
    stakedLyraBalance: BigNumber,
    isPendingRewards: boolean
  ) {
    this.lyra = lyra
    this.account = account
    this.globalEpoch = globalEpoch
    this.accountEpoch = accountEpoch
    const avgStkLyraBalance =
      this.globalEpoch.progressDays > 0 ? this.accountEpoch.stkLyraDays / this.globalEpoch.progressDays : 0
    this.stakedLyraBalance = this.globalEpoch.isComplete ? avgStkLyraBalance : fromBigNumber(stakedLyraBalance)
    this.vaultTokenBalances = vaultTokenBalances.reduce(
      (lpTokenBalances, lpTokenBalance) => ({
        ...lpTokenBalances,
        [lpTokenBalance.market.baseToken.symbol]: lpTokenBalance,
      }),
      {}
    )
    this.stakingRewards = {
      lyra: this.accountEpoch.inflationaryRewards.lyra,
      op: this.accountEpoch.inflationaryRewards.op,
    }
    this.stakingRewardsUnlockTimestamp = {
      lyra: this.globalEpoch.endTimestamp + SECONDS_IN_SIX_MONTHS,
      op: this.globalEpoch.endTimestamp,
    }
    this.totalVaultRewards = globalEpoch.markets.reduce(
      (sum, market) => {
        const { lyra, op } = this.vaultRewards(market.address)
        return {
          lyra: sum.lyra + lyra,
          op: sum.op + op,
        }
      },
      { lyra: 0, op: 0 }
    )
    this.tradingFeeRebate = this.globalEpoch.tradingFeeRebate(this.stakedLyraBalance)
    this.tradingFees = this.accountEpoch.tradingRewards.tradingFees
    this.tradingRewards = this.globalEpoch.tradingRewards(this.tradingFees, this.stakedLyraBalance)
    this.isPendingRewards = isPendingRewards
  }

  // Getters

  static async getByOwner(lyra: Lyra, address: string): Promise<AccountRewardEpoch[]> {
    const distributorContract = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.MultiDistributor)
    const [block, markets] = await Promise.all([lyra.provider.getBlock('latest'), lyra.markets()])
    const [accountEpochDatas, globalEpochs, { balance: stakedLyraBalance }, lpTokenBalances, claimAddedEvents] =
      await Promise.all([
        fetchAccountRewardEpochData(lyra, address, block.timestamp),
        GlobalRewardEpoch.getAll(lyra),
        lyra.account(address).stakedLyraBalance(),
        Promise.all(
          markets.map(market =>
            lyra.account(address).liquidityTokenBalance(market.__marketData.marketAddresses.optionMarket)
          )
        ),
        await distributorContract.queryFilter(distributorContract.filters.ClaimAdded(null, address, null, null, null)),
      ])
    return accountEpochDatas
      .map(accountEpochData => {
        const globalEpoch = globalEpochs.find(
          globalEpoch =>
            globalEpoch.startTimestamp === accountEpochData.startTimestamp &&
            globalEpoch.endTimestamp === accountEpochData.endTimestamp
        )
        if (!globalEpoch) {
          throw new Error('Missing corresponding global epoch for account epoch')
        }
        // Find claims added for or after epoch
        const epochClaimAddedEvents = claimAddedEvents.filter(claimAdded =>
          claimAdded.args.epochTimestamp.gte(globalEpoch.startTimestamp)
        )
        const claimAddedTags = getClaimAddedTags(
          accountEpochData.MMVRewards,
          accountEpochData.tradingRewards,
          accountEpochData.inflationaryRewards
        )
        let isPendingRewards = false
        // Set isPending if no claimAdded events or waiting on events for all programs
        if (epochClaimAddedEvents.length > 0) {
          epochClaimAddedEvents.forEach(claimAdded => {
            claimAddedTags[claimAdded.args.tag] = true
          })
          isPendingRewards = !Object.values(claimAddedTags).every(val => val)
        } else {
          isPendingRewards = true
        }
        return new AccountRewardEpoch(
          lyra,
          address,
          accountEpochData,
          globalEpoch,
          lpTokenBalances,
          stakedLyraBalance,
          isPendingRewards
        )
      })
      .sort((a, b) => a.globalEpoch.endTimestamp - b.globalEpoch.endTimestamp)
  }

  static async getByStartTimestamp(
    lyra: Lyra,
    address: string,
    startTimestamp: number
  ): Promise<AccountRewardEpoch | null> {
    const epochs = await AccountRewardEpoch.getByOwner(lyra, address)
    const epoch = epochs.find(epoch => epoch.globalEpoch.startTimestamp === startTimestamp)
    return epoch ?? null
  }

  // Dynamic Fields

  vaultApy(marketAddressOrName: string): AccountRewardEpochAPY {
    const vaultTokenBalance = this.vaultTokenBalance(marketAddressOrName)
    if (vaultTokenBalance === 0) {
      return this.globalEpoch.minVaultApy(marketAddressOrName)
    } else {
      return this.globalEpoch.vaultApy(marketAddressOrName, this.stakedLyraBalance, vaultTokenBalance)
    }
  }

  vaultApyMultiplier(marketAddressOrName: string): number {
    const vaultTokenBalance = this.vaultTokenBalance(marketAddressOrName)
    if (vaultTokenBalance === 0) {
      return 1
    } else {
      return this.globalEpoch.vaultApyMultiplier(marketAddressOrName, this.stakedLyraBalance, vaultTokenBalance)
    }
  }

  vaultTokenBalance(marketAddressOrName: string): number {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const boostedLpDays = this.accountEpoch.boostedLpDays[marketKey] ?? 0
    const avgVaultTokenBalance = this.globalEpoch.progressDays > 0 ? boostedLpDays / this.globalEpoch.progressDays : 0
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    // Uses average for historical epochs, realtime for current epoch
    const vaultTokenBalance = this.globalEpoch.isComplete ? avgVaultTokenBalance : currVaultTokenBalance
    return vaultTokenBalance
  }

  vaultRewards(marketAddressOrName: string): AccountRewardEpochTokens {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const mmvRewards = this.accountEpoch.MMVRewards[marketKey]
    if (!mmvRewards) {
      return {
        lyra: 0,
        op: 0,
      }
    }
    const isIgnored = !!mmvRewards.isIgnored
    return {
      lyra: !isIgnored ? mmvRewards.lyra ?? 0 : 0,
      op: !isIgnored ? mmvRewards.op ?? 0 : 0,
    }
  }
}
