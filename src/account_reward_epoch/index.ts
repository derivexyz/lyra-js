import { AccountBalances, AccountLiquidityTokenBalance, AccountLyraBalances } from '../account'
import { Deployment, LyraGlobalContractId } from '../constants/contracts'
import { Network } from '../constants/network'
import { ClaimAddedEvent } from '../contracts/common/typechain/MultiDistributor'
import { GlobalRewardEpoch } from '../global_reward_epoch'
import { RewardEpochTokenAmount } from '../global_reward_epoch'
import Lyra from '../lyra'
import fetchAccountRewardEpochData, {
  AccountArrakisRewards,
  AccountRewardEpochData,
} from '../utils/fetchAccountRewardEpochData'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getGlobalContract from '../utils/getGlobalContract'
import parseClaimAddedTags from './parseClaimAddedTags'

export class AccountRewardEpoch {
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  lyra: Lyra
  account: string
  globalEpoch: GlobalRewardEpoch
  accountEpoch: AccountRewardEpochData
  stakedLyraBalance: number
  tradingFeeRebate: number
  tradingFees: number
  stakingRewards: RewardEpochTokenAmount[]
  isPendingRewards: boolean
  stakingRewardsUnlockTimestamp: RewardEpochTokenAmount[]
  totalVaultRewards: RewardEpochTokenAmount[]
  tradingRewards: RewardEpochTokenAmount[]
  shortCollateralRewards: RewardEpochTokenAmount[]
  wethLyraStaking: AccountArrakisRewards
  constructor(
    lyra: Lyra,
    account: string,
    accountEpoch: AccountRewardEpochData,
    globalEpoch: GlobalRewardEpoch,
    balances: AccountBalances[],
    lyraBalances: AccountLyraBalances,
    claimAddedEvents: ClaimAddedEvent[]
  ) {
    this.lyra = lyra
    this.account = account
    this.globalEpoch = globalEpoch
    this.accountEpoch = accountEpoch
    const avgStkLyraBalance =
      this.globalEpoch.progressDays > 0
        ? this.accountEpoch.stakingRewards.stkLyraDays / this.globalEpoch.progressDays
        : 0
    this.stakedLyraBalance = this.globalEpoch.isComplete
      ? avgStkLyraBalance
      : fromBigNumber(lyraBalances.ethereumStkLyra.add(lyraBalances.optimismStkLyra))
    this.vaultTokenBalances = balances.reduce(
      (lpTokenBalances, balance) => ({
        ...lpTokenBalances,
        [balance.baseAsset.symbol]: balance.liquidityToken,
      }),
      {}
    )

    this.stakingRewards = this.accountEpoch.stakingRewards.rewards
    this.stakingRewardsUnlockTimestamp = this.accountEpoch.stakingRewards?.rewards?.map(token => {
      return {
        ...token,
        amount: this.globalEpoch.endTimestamp,
      }
    })
    const marketVaultRewards = globalEpoch.markets.map(market => this.vaultRewards(market.address)).flat()
    const marketVaultRewardsMap: { [tokenAddress: string]: RewardEpochTokenAmount } = {}
    marketVaultRewards.forEach(vaultReward => {
      if (!marketVaultRewardsMap[vaultReward.address]) {
        marketVaultRewardsMap[vaultReward.address] = vaultReward
      } else {
        marketVaultRewardsMap[vaultReward.address].amount += vaultReward.amount
      }
    })
    this.totalVaultRewards = Object.values(marketVaultRewardsMap)
    this.tradingFeeRebate = this.globalEpoch.tradingFeeRebate(this.stakedLyraBalance)
    this.tradingFees = this.accountEpoch.tradingRewards.fees
    this.tradingRewards = this.globalEpoch.tradingRewards(this.tradingFees, this.stakedLyraBalance)
    this.shortCollateralRewards = this.globalEpoch.shortCollateralRewards(
      this.accountEpoch.tradingRewards.shortCollateralRewardDollars
    )
    const claimAddedTags = parseClaimAddedTags(claimAddedEvents)

    // TODO @dillon - refactor this later
    const lyraTradingRewards =
      this.tradingRewards.find(token => ['lyra', 'stklyra'].includes(token.symbol.toLowerCase()))?.amount ?? 0
    const lyraShortCollateralRewards =
      this.shortCollateralRewards.find(token => ['lyra', 'stklyra'].includes(token.symbol.toLowerCase()))?.amount ?? 0
    const opTradingRewards = this.tradingRewards.find(token => ['op'].includes(token.symbol.toLowerCase()))?.amount ?? 0
    const opShortCollateralRewards =
      this.shortCollateralRewards.find(token => ['op'].includes(token.symbol.toLowerCase()))?.amount ?? 0
    const isTradingPending =
      (lyraTradingRewards + lyraShortCollateralRewards > 0 && !claimAddedTags.tradingRewards.LYRA) ||
      (opTradingRewards + opShortCollateralRewards > 0 && !claimAddedTags.tradingRewards.OP)

    // ignore lyra rewards due to 6mo lock
    const isStakingPending = false

    const isVaultsPending = globalEpoch.markets.every(market => {
      const vaultRewards = this.vaultRewards(market.address)
      const marketKey = market.baseToken.symbol
      // TODO @dillon - refactor this later
      const lyraVaultRewards =
        vaultRewards.find(token => ['lyra', 'stklyra'].includes(token.symbol.toLowerCase()))?.amount ?? 0
      const opVaultRewards = vaultRewards.find(token => ['op'].includes(token.symbol.toLowerCase()))?.amount ?? 0
      return (
        (lyraVaultRewards && !claimAddedTags.vaultRewards[marketKey]?.LYRA) ||
        (opVaultRewards && !claimAddedTags.vaultRewards[marketKey]?.OP)
      )
    })

    this.isPendingRewards = !this.globalEpoch.isComplete || isTradingPending || isStakingPending || isVaultsPending

    this.wethLyraStaking = this.accountEpoch.arrakisRewards ?? {
      rewards: [],
      gUniTokensStaked: 0,
      percentShare: 0,
    }
  }

  // Getters

  static async getByOwner(lyra: Lyra, address: string): Promise<AccountRewardEpoch[]> {
    if (lyra.deployment !== Deployment.Mainnet) {
      return []
    }
    const distributorContract =
      lyra.network === Network.Optimism
        ? getGlobalContract(lyra, LyraGlobalContractId.MultiDistributor, lyra.optimismProvider)
        : null
    const claimAddedEvents =
      lyra.network === Network.Optimism
        ? (await distributorContract?.queryFilter(
            distributorContract.filters.ClaimAdded(null, address, null, null, null)
          )) ?? []
        : []
    const [accountEpochDatas, globalEpochs, lyraBalances, balances] = await Promise.all([
      fetchAccountRewardEpochData(lyra, address),
      GlobalRewardEpoch.getAll(lyra),
      lyra.account(address).lyraBalances(),
      lyra.account(address).balances(),
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
        const epochClaimAddedEvents = claimAddedEvents.filter(
          claimAdded => claimAdded.args.epochTimestamp.toNumber() === globalEpoch.startTimestamp
        )
        return new AccountRewardEpoch(
          lyra,
          address,
          accountEpochData,
          globalEpoch,
          balances,
          lyraBalances,
          epochClaimAddedEvents
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
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    // Uses average for historical epochs, realtime for current epoch
    const vaultTokenBalance = this.globalEpoch.isComplete ? avgVaultTokenBalance : currVaultTokenBalance
    return vaultTokenBalance
  }

  vaultRewards(marketAddressOrName: string): RewardEpochTokenAmount[] {
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const mmvRewards = this.accountEpoch.mmvRewards ? this.accountEpoch.mmvRewards[marketKey] : null
    if (!mmvRewards) {
      return []
    }
    const isIgnored = !!mmvRewards.isIgnored
    return mmvRewards.rewards.map(token => {
      const amount = isIgnored ? 0 : token.amount
      return {
        ...token,
        amount,
      }
    })
  }
}
