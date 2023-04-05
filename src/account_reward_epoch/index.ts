import { BigNumber, PopulatedTransaction } from 'ethers'

import { AccountBalances, AccountLiquidityTokenBalance, AccountLyraBalances } from '../account'
import { Deployment, LyraGlobalContractId } from '../constants/contracts'
import { MIN_REWARD_AMOUNT } from '../constants/rewards'
import { GlobalRewardEpoch, RewardEpochToken } from '../global_reward_epoch'
import { RewardEpochTokenAmount } from '../global_reward_epoch'
import Lyra from '../lyra'
import buildTx from '../utils/buildTx'
import fetchAccountRewardEpochData, { AccountRewardEpochData } from '../utils/fetchAccountRewardEpochData'
import fetchClaimAddedEvents from '../utils/fetchClaimAddedEvents'
import fetchClaimEvents from '../utils/fetchClaimEvents'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getGlobalContract from '../utils/getGlobalContract'
import getUniqueBy from '../utils/getUniqueBy'
import multicall from '../utils/multicall'
import getDistributedTradingRewards from './getDistributedTradingRewards'
import getDistributedVaultRewards from './getDistributedVaultRewards'
import getTotalClaimableTradingRewards from './getTotalClaimableTradingRewards'
import getTotalClaimableVaultRewards from './getTotalClaimableVaultRewards'

export type ClaimAddedEvent = {
  amount: BigNumber
  blockNumber: number
  claimer: string
  epochTimestamp: number
  rewardToken: string
  tag: string
  timestamp: number
}

export type ClaimEvent = {
  amount: BigNumber
  blockNumber: number
  claimer: string
  rewardToken: string
  timestamp: number
}

export class AccountRewardEpoch {
  lyra: Lyra
  account: string
  globalEpoch: GlobalRewardEpoch
  accountEpoch: AccountRewardEpochData
  stakedLyraBalance: number
  tradingFeeRebate: number
  tradingFees: number
  lyraBalances: AccountLyraBalances
  tradingRewards: RewardEpochTokenAmount[]
  isTradingRewardsDistributed: boolean
  totalClaimableRewards: RewardEpochTokenAmount[]
  totalClaimableTradingRewards: RewardEpochTokenAmount[]
  private vaultTokenBalancesMap: Record<string, AccountLiquidityTokenBalance>
  private totalClaimableVaultRewardsMap: Record<string, RewardEpochTokenAmount[]>
  private distributedVaultRewardsMap: Record<string, RewardEpochTokenAmount[]>
  private calculatedVaultRewardsMap: Record<string, RewardEpochTokenAmount[]>
  private isVaultRewardsDistributedMap: Record<string, boolean>

  constructor(
    lyra: Lyra,
    account: string,
    accountEpoch: AccountRewardEpochData,
    globalEpoch: GlobalRewardEpoch,
    balances: AccountBalances[],
    lyraBalances: AccountLyraBalances,
    claimAddedEvents: ClaimAddedEvent[],
    claimEvents: ClaimEvent[],
    rewardTokens: RewardEpochToken[],
    totalClaimableRewards: RewardEpochTokenAmount[]
  ) {
    this.lyra = lyra
    this.account = account
    this.globalEpoch = globalEpoch
    this.accountEpoch = accountEpoch
    this.lyraBalances = lyraBalances
    const avgStkLyraBalance =
      globalEpoch.progressDays > 0 ? accountEpoch.stakingRewards.stkLyraDays / globalEpoch.progressDays : 0
    this.stakedLyraBalance = globalEpoch.isComplete
      ? avgStkLyraBalance
      : fromBigNumber(lyraBalances.ethereumStkLyra.add(lyraBalances.optimismStkLyra).add(lyraBalances.arbitrumStkLyra))

    this.vaultTokenBalancesMap = balances.reduce(
      (lpTokenBalances, balance) => ({
        ...lpTokenBalances,
        [balance.baseAsset.symbol]: balance.liquidityToken,
      }),
      {}
    )

    this.tradingFeeRebate = globalEpoch.tradingFeeRebate(this.stakedLyraBalance)
    const integratorTradingFees = accountEpoch.integratorTradingRewards?.fees ?? 0
    this.tradingFees = integratorTradingFees > 0 ? integratorTradingFees : accountEpoch.tradingRewards.fees

    this.tradingRewards = globalEpoch.tradingRewards(this.tradingFees, this.stakedLyraBalance)

    const distributedTradingRewards = getDistributedTradingRewards(globalEpoch, claimAddedEvents)
    this.isTradingRewardsDistributed = !!distributedTradingRewards.find(d => d.amount > 0)
    this.tradingRewards = this.isTradingRewardsDistributed
      ? distributedTradingRewards
      : globalEpoch.tradingRewards(this.tradingFees, this.stakedLyraBalance)

    this.totalClaimableRewards = totalClaimableRewards
    this.totalClaimableTradingRewards = getTotalClaimableTradingRewards(rewardTokens, claimAddedEvents, claimEvents)
    this.totalClaimableVaultRewardsMap = globalEpoch.markets.reduce(
      (map, market) => ({
        ...map,
        [market.baseToken.symbol]: getTotalClaimableVaultRewards(market, rewardTokens, claimAddedEvents, claimEvents),
      }),
      {}
    )
    this.distributedVaultRewardsMap = globalEpoch.markets.reduce(
      (map, market) => ({
        ...map,
        [market.baseToken.symbol]: getDistributedVaultRewards(market, globalEpoch, claimAddedEvents),
      }),
      {}
    )
    this.calculatedVaultRewardsMap = globalEpoch.markets.reduce((map, market) => {
      const marketKey = market.baseToken.symbol
      const mmvRewards = accountEpoch.mmvRewards ? accountEpoch.mmvRewards[marketKey] : null
      const isIgnored = !!mmvRewards?.isIgnored
      return {
        ...map,
        [market.baseToken.symbol]:
          mmvRewards && !isIgnored ? mmvRewards.rewards.filter(r => r.amount > MIN_REWARD_AMOUNT) : [],
      }
    }, {})
    this.isVaultRewardsDistributedMap = globalEpoch.markets.reduce(
      (map, market) => ({
        ...map,
        [market.baseToken.symbol]: !!this.distributedVaultRewardsMap[market.baseToken.symbol]?.find(d => d.amount > 0),
      }),
      {}
    )
  }

  // Getters

  static async getByOwner(lyra: Lyra, address: string): Promise<AccountRewardEpoch[]> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return []
    }
    const [accountEpochDatas, globalEpochs, lyraBalances, balances, claimAddedEvents, claimEvents] = await Promise.all([
      fetchAccountRewardEpochData(lyra, address),
      GlobalRewardEpoch.getAll(lyra),
      lyra.account(address).lyraBalances(),
      lyra.account(address).balances(),
      fetchClaimAddedEvents(lyra, lyra.chain, address),
      fetchClaimEvents(lyra, lyra.chain, address),
    ])

    const uniqueRewardTokens = getUniqueBy(
      globalEpochs.flatMap(e => e.rewardTokens),
      r => r.address
    )

    const distributorContract = getGlobalContract(lyra, LyraGlobalContractId.MultiDistributor)
    const { returnData } = await multicall(
      lyra,
      uniqueRewardTokens.map(({ address: tokenAddress }) => ({
        contract: distributorContract,
        function: 'claimableBalances',
        args: [address, tokenAddress],
      }))
    )
    const totalClaimableBalances = (returnData as BigNumber[])
      .map((amount, idx) => ({
        ...uniqueRewardTokens[idx],
        amount: fromBigNumber(amount, uniqueRewardTokens[idx].decimals),
      }))
      .filter(({ amount }) => amount > 0)

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
        return new AccountRewardEpoch(
          lyra,
          address,
          accountEpochData,
          globalEpoch,
          balances,
          lyraBalances,
          claimAddedEvents,
          claimEvents,
          uniqueRewardTokens,
          totalClaimableBalances
        )
      })
      .sort((a, b) => a.globalEpoch.endTimestamp - b.globalEpoch.endTimestamp)
  }

  static async getByStartTimestamp(
    lyra: Lyra,
    address: string,
    startTimestamp: number
  ): Promise<AccountRewardEpoch | null> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return null
    }
    const epochs = await AccountRewardEpoch.getByOwner(lyra, address)
    const epoch = epochs.find(epoch => epoch.globalEpoch.startTimestamp === startTimestamp)
    return epoch ?? null
  }

  static claim(lyra: Lyra, address: string, tokenAddresses: string[]): PopulatedTransaction {
    const distributorContract = getGlobalContract(lyra, LyraGlobalContractId.MultiDistributor)
    const calldata = distributorContract.interface.encodeFunctionData('claim', [tokenAddresses])
    return buildTx(lyra.provider, lyra.provider.network.chainId, distributorContract.address, address, calldata)
  }

  // Dynamic Fields

  vaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const vaultTokenBalance = this.vaultTokenBalance(marketAddressOrName)
    if (vaultTokenBalance === 0) {
      return this.globalEpoch.minVaultApy(marketAddressOrName)
    } else {
      return this.globalEpoch.vaultApy(marketAddressOrName, this.stakedLyraBalance, vaultTokenBalance)
    }
  }

  vaultMaxBoost(marketAddressOrName: string): number {
    const vaultTokenBalance = this.vaultTokenBalance(marketAddressOrName)
    if (vaultTokenBalance === 0) {
      return this.globalEpoch.vaultMaxBoost(marketAddressOrName, 0)
    } else {
      return this.globalEpoch.vaultMaxBoost(marketAddressOrName, vaultTokenBalance)
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
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const boostedLpDays: number = this.accountEpoch.mmvRewards
      ? this.accountEpoch.mmvRewards[marketKey]?.boostedLpDays ?? 0
      : 0
    const avgVaultTokenBalance = this.globalEpoch.progressDays > 0 ? boostedLpDays / this.globalEpoch.progressDays : 0
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalancesMap[marketKey].balance)
    // Uses average for historical epochs, realtime for current epoch
    const vaultTokenBalance = this.globalEpoch.isComplete ? avgVaultTokenBalance : currVaultTokenBalance
    return vaultTokenBalance
  }

  vaultRewards(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    if (this.isVaultRewardsDistributed(marketAddressOrName)) {
      return this.distributedVaultRewardsMap[marketKey]
    } else {
      return this.calculatedVaultRewardsMap[marketKey]
    }
  }

  totalClaimableVaultRewards(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    return this.totalClaimableVaultRewardsMap[marketKey]
  }

  isVaultRewardsDistributed(marketAddressOrName: string): boolean {
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    return this.isVaultRewardsDistributedMap[marketKey]
  }
}
