import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { Account, AccountLiquidityTokenBalance, AccountLyraStaking } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import { SECONDS_IN_DAY } from '../constants/time'
import { GlobalRewardEpoch, GlobalRewardEpochAPY, GlobalRewardEpochTokens } from '../global_reward_epoch'
import Lyra from '../lyra'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import findMarket from '../utils/findMarket'
import fromBigNumber from '../utils/fromBigNumber'
import getLyraContract from '../utils/getLyraContract'
import getMarketAddresses from '../utils/getMarketAddresses'
import insertTxGasEstimate from '../utils/insertTxGasEstimate'

export enum UnstakeDisabledReason {
  NotInUnstakeWindow = 'NotInUnstakeWindow',
  InsufficientBalance = 'InsufficientBalance',
  ZeroAmount = 'ZeroAmount',
}

type UnstakeData = {
  globalEpoch: GlobalRewardEpoch
  account: Account
  accountStaking: AccountLyraStaking
  vaultTokenBalances: AccountLiquidityTokenBalance[]
  amount: BigNumber
}

export class LyraUnstake {
  private lyra: Lyra
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  globalEpoch: GlobalRewardEpoch
  accountStaking: AccountLyraStaking
  account: Account
  amount: BigNumber
  stakedLyraBalance: BigNumber
  // Derived
  newStakedLyraBalance: BigNumber
  newStakingYieldPerDay: GlobalRewardEpochTokens
  stakingYieldPerDay: GlobalRewardEpochTokens
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
    this.stakedLyraBalance = data.accountStaking.stakedLyraBalance.balance
    this.newStakedLyraBalance = this.stakedLyraBalance.sub(this.amount)
    if (this.newStakedLyraBalance.lt(0)) {
      this.newStakedLyraBalance = ZERO_BN
    }

    this.vaultTokenBalances = data.vaultTokenBalances.reduce(
      (lpTokenBalances, lpTokenBalance) => ({
        ...lpTokenBalances,
        [lpTokenBalance.market.baseToken.symbol]: lpTokenBalance,
      }),
      {}
    )

    const totalStakedLyraSupply = fromBigNumber(this.accountStaking.staking.totalSupply)
    const stakedLyraPctShare =
      totalStakedLyraSupply > 0 ? fromBigNumber(this.stakedLyraBalance) / totalStakedLyraSupply : 0
    const newStakedLyraPctShare =
      totalStakedLyraSupply > 0 ? fromBigNumber(this.newStakedLyraBalance) / totalStakedLyraSupply : 0

    const totalLyraPerDay =
      this.globalEpoch.duration > 0
        ? (this.globalEpoch.totalStakingRewards.lyra / this.globalEpoch.duration) * SECONDS_IN_DAY
        : 0
    const lyraPerDay = totalLyraPerDay * stakedLyraPctShare
    const newLyraPerDay = totalLyraPerDay * newStakedLyraPctShare

    const totalOpPerDay =
      this.globalEpoch.duration > 0
        ? (this.globalEpoch.totalStakingRewards.op / this.globalEpoch.duration) * SECONDS_IN_DAY
        : 0
    const opPerDay = totalOpPerDay * stakedLyraPctShare
    const newOpPerDay = totalOpPerDay * newStakedLyraPctShare

    this.stakingYieldPerDay = {
      lyra: lyraPerDay,
      op: opPerDay,
    }
    this.newStakingYieldPerDay = {
      lyra: newLyraPerDay,
      op: newOpPerDay,
    }

    this.tradingFeeRebate = this.globalEpoch.tradingFeeRebate(fromBigNumber(this.stakedLyraBalance))
    this.newTradingFeeRebate = this.globalEpoch.tradingFeeRebate(fromBigNumber(this.newStakedLyraBalance))

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
      const lyraStakingModuleProxyContract = getLyraContract(
        lyra.provider,
        lyra.deployment,
        LyraContractId.LyraStakingModuleProxy
      )
      const txData = lyraStakingModuleProxyContract.interface.encodeFunctionData('redeem', [
        this.account.address,
        this.amount,
      ])
      this.tx = buildTx(lyra, lyraStakingModuleProxyContract.address, this.account.address, txData)
    } else {
      this.tx = null
    }
  }

  // Getters

  static async get(lyra: Lyra, address: string, amount: BigNumber): Promise<LyraUnstake> {
    const account = Account.get(lyra, address)
    const marketAddresses = await getMarketAddresses(lyra)
    const [accountStaking, globalEpoch, vaultTokenBalances] = await Promise.all([
      account.lyraStaking(),
      lyra.latestGlobalRewardEpoch(),
      Promise.all(marketAddresses.map(market => lyra.account(address).liquidityTokenBalance(market.optionMarket))),
    ])
    const unstake = new LyraUnstake(lyra, {
      globalEpoch,
      account,
      amount,
      accountStaking,
      vaultTokenBalances,
    })
    if (unstake?.tx) {
      unstake.tx = await insertTxGasEstimate(lyra, unstake.tx)
    }
    return unstake
  }

  // Transactions

  static async requestUnstake(lyra: Lyra, address: string): Promise<PopulatedTransaction> {
    const lyraStakingModuleProxyContract = getLyraContract(
      lyra.provider,
      lyra.deployment,
      LyraContractId.LyraStakingModuleProxy
    )
    const data = lyraStakingModuleProxyContract.interface.encodeFunctionData('cooldown')
    const tx = await buildTxWithGasEstimate(lyra, lyraStakingModuleProxyContract.address, address, data)
    return tx
  }

  // Dynamic Fields

  vaultApy(marketAddressOrName: string): GlobalRewardEpochAPY {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const currStakedLyraBalance = fromBigNumber(this.stakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    return this.globalEpoch.vaultApy(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
  }

  newVaultApy(marketAddressOrName: string): GlobalRewardEpochAPY {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const newStakedLyraBalance = fromBigNumber(this.newStakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    return this.globalEpoch.vaultApy(marketAddressOrName, newStakedLyraBalance, currVaultTokenBalance)
  }
}
