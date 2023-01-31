import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { Account, AccountBalances, AccountLiquidityTokenBalance, AccountLyraStaking } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraGlobalContractId } from '../constants/contracts'
import { SECONDS_IN_DAY } from '../constants/time'
import { GlobalRewardEpoch, RewardEpochTokenAmount } from '../global_reward_epoch'
import Lyra from '../lyra'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getGlobalContract from '../utils/getGlobalContract'
import insertTxGasEstimate from '../utils/insertTxGasEstimate'

export enum UnstakeDisabledReason {
  NotInUnstakeWindow = 'NotInUnstakeWindow',
  InsufficientBalance = 'InsufficientBalance',
  ZeroAmount = 'ZeroAmount',
}

type UnstakeData = {
  globalEpoch: GlobalRewardEpoch | null
  account: Account
  accountStaking: AccountLyraStaking
  accountBalances: AccountBalances[]
  amount: BigNumber
}

export class LyraUnstake {
  lyra: Lyra
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  globalEpoch: GlobalRewardEpoch | null
  accountStaking: AccountLyraStaking
  account: Account
  amount: BigNumber
  stakedLyraBalance: BigNumber
  // Derived
  newStakedLyraBalance: BigNumber
  newStakingYieldPerDay: RewardEpochTokenAmount[]
  stakingYieldPerDay: RewardEpochTokenAmount[]
  tradingFeeRebate: number
  newTradingFeeRebate: number
  disabledReason: UnstakeDisabledReason | null
  tx: PopulatedTransaction | null

  constructor(lyra: Lyra, data: UnstakeData) {
    this.lyra = lyra
    this.globalEpoch = data.globalEpoch
    this.accountStaking = data.accountStaking
    this.account = data.account
    this.amount = data.amount
    this.stakedLyraBalance = data.accountStaking.lyraBalances.ethereumStkLyra
    this.newStakedLyraBalance = this.stakedLyraBalance.sub(this.amount)
    if (this.newStakedLyraBalance.lt(0)) {
      this.newStakedLyraBalance = ZERO_BN
    }

    this.vaultTokenBalances = data.accountBalances.reduce(
      (lpTokenBalances, accountBalance) => ({
        ...lpTokenBalances,
        [accountBalance.baseAsset.symbol]: accountBalance.liquidityToken,
      }),
      {}
    )

    const totalStakedLyraSupply = fromBigNumber(this.accountStaking.staking.totalSupply)
    const stakedLyraPctShare =
      totalStakedLyraSupply > 0 ? fromBigNumber(this.stakedLyraBalance) / totalStakedLyraSupply : 0
    const newStakedLyraPctShare =
      totalStakedLyraSupply > 0 ? fromBigNumber(this.newStakedLyraBalance) / totalStakedLyraSupply : 0

    this.stakingYieldPerDay =
      this.globalEpoch?.totalStakingRewards.map(token => {
        const totalTokensPerDay =
          this.globalEpoch && this.globalEpoch.duration > 0
            ? (token.amount / this.globalEpoch.duration) * SECONDS_IN_DAY
            : 0
        return {
          ...token,
          amount: totalTokensPerDay * stakedLyraPctShare,
        }
      }) ?? []

    this.newStakingYieldPerDay =
      this.globalEpoch?.totalStakingRewards.map(token => {
        const totalTokensPerDay =
          this.globalEpoch && this.globalEpoch.duration > 0
            ? (token.amount / this.globalEpoch.duration) * SECONDS_IN_DAY
            : 0
        return {
          ...token,
          amount: totalTokensPerDay * newStakedLyraPctShare,
        }
      }) ?? []

    this.tradingFeeRebate = this.globalEpoch?.tradingFeeRebate(fromBigNumber(this.stakedLyraBalance)) ?? 0
    this.newTradingFeeRebate = this.globalEpoch?.tradingFeeRebate(fromBigNumber(this.newStakedLyraBalance)) ?? 0

    // Determine disabled reason
    if (!data.accountStaking.isInUnstakeWindow) {
      this.disabledReason = UnstakeDisabledReason.NotInUnstakeWindow
    } else if (this.amount.gt(this.stakedLyraBalance)) {
      this.disabledReason = UnstakeDisabledReason.InsufficientBalance
    } else if (this.amount.eq(ZERO_BN)) {
      this.disabledReason = UnstakeDisabledReason.ZeroAmount
    } else {
      this.disabledReason = null
    }

    // Build transaction
    if (!this.disabledReason) {
      const lyraStakingModuleProxyContract = getGlobalContract(
        lyra,
        LyraGlobalContractId.LyraStakingModule,
        lyra.ethereumProvider
      )
      const txData = lyraStakingModuleProxyContract.interface.encodeFunctionData('redeem', [
        this.account.address,
        this.amount,
      ])
      this.tx = buildTx(
        lyra.ethereumProvider ?? lyra.provider,
        1,
        lyraStakingModuleProxyContract.address,
        this.account.address,
        txData
      )
    } else {
      this.tx = null
    }
  }

  // Getters

  static async get(lyra: Lyra, address: string, amount: BigNumber): Promise<LyraUnstake> {
    const account = Account.get(lyra, address)
    const [accountStaking, globalEpoch, accountBalances] = await Promise.all([
      account.lyraStaking(),
      lyra.latestGlobalRewardEpoch(),
      lyra.account(address).balances(),
    ])
    const unstake = new LyraUnstake(lyra, {
      globalEpoch,
      account,
      amount,
      accountStaking,
      accountBalances,
    })
    if (unstake?.tx) {
      unstake.tx = await insertTxGasEstimate(lyra.ethereumProvider ?? lyra.provider, unstake.tx)
    }
    return unstake
  }

  // Transactions

  static async requestUnstake(lyra: Lyra, address: string): Promise<PopulatedTransaction> {
    const lyraStakingModuleProxyContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    const data = lyraStakingModuleProxyContract.interface.encodeFunctionData('cooldown')
    const tx = await buildTxWithGasEstimate(
      lyra.ethereumProvider ?? lyra.provider,
      1,
      lyraStakingModuleProxyContract.address,
      address,
      data
    )
    return tx
  }

  // Dynamic Fields

  vaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    if (!this.globalEpoch) {
      return []
    }
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const currStakedLyraBalance = fromBigNumber(this.stakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    return this.globalEpoch.vaultApy(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
  }

  newVaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    if (!this.globalEpoch) {
      return []
    }
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const newStakedLyraBalance = fromBigNumber(this.newStakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    return this.globalEpoch.vaultApy(marketAddressOrName, newStakedLyraBalance, currVaultTokenBalance)
  }
}
