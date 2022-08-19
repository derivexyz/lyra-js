import { PopulatedTransaction } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { Account, AccountLiquidityTokenBalance, AccountLyraStaking } from '..'
import { MAX_BN, ZERO_BN } from '../constants/bn'
import { LYRA_OPTIMISM_KOVAN_ADDRESS, LYRA_OPTIMISM_MAINNET_ADDRESS, LyraContractId } from '../constants/contracts'
import { SECONDS_IN_DAY } from '../constants/time'
import { GlobalRewardEpoch, GlobalRewardEpochAPY, GlobalRewardEpochTokens } from '../global_reward_epoch'
import Lyra, { Deployment } from '../lyra'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import findMarket from '../utils/findMarket'
import fromBigNumber from '../utils/fromBigNumber'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraContract from '../utils/getLyraContract'
import getMarketAddresses from '../utils/getMarketAddresses'
import insertTxGasEstimate from '../utils/insertTxGasEstimate'

type StakeData = {
  account: Account
  accountStaking: AccountLyraStaking
  globalEpoch: GlobalRewardEpoch
  vaultTokenBalances: AccountLiquidityTokenBalance[]
  amount: BigNumber
}

export enum StakeDisabledReason {
  InsufficientBalance = 'InsufficientBalance',
  InsufficientAllowance = 'InsufficientAllowance',
  ZeroAmount = 'ZeroAmount',
}

export class Stake {
  private lyra: Lyra
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  globalEpoch: GlobalRewardEpoch
  accountStaking: AccountLyraStaking
  account: Account
  amount: BigNumber
  lyraBalance: BigNumber
  stakedLyraBalance: BigNumber
  allowance: BigNumber
  // Derived
  newStakedLyraBalance: BigNumber
  newStakingYieldPerDay: GlobalRewardEpochTokens
  stakingYieldPerDay: GlobalRewardEpochTokens
  tradingFeeRebate: number
  newTradingFeeRebate: number
  disabledReason: StakeDisabledReason | null
  tx: PopulatedTransaction | null

  constructor(lyra: Lyra, data: StakeData) {
    this.lyra = lyra
    this.globalEpoch = data.globalEpoch
    this.accountStaking = data.accountStaking
    this.account = data.account
    this.amount = data.amount
    this.lyraBalance = data.accountStaking.lyraBalance.balance
    this.stakedLyraBalance = data.accountStaking.stakedLyraBalance.balance
    this.newStakedLyraBalance = this.stakedLyraBalance.add(this.amount)
    this.allowance = data.accountStaking.lyraBalance.stakingAllowance

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
    if (this.amount.gt(this.lyraBalance)) {
      this.disabledReason = StakeDisabledReason.InsufficientBalance
    } else if (this.amount.gt(this.allowance)) {
      this.disabledReason = StakeDisabledReason.InsufficientAllowance
    } else if (this.amount.eq(ZERO_BN)) {
      this.disabledReason = StakeDisabledReason.ZeroAmount
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
      const txData = lyraStakingModuleProxyContract.interface.encodeFunctionData('stake', [
        this.account.address,
        this.amount,
      ])
      this.tx = buildTx(lyra, lyraStakingModuleProxyContract.address, this.account.address, txData)
    } else {
      this.tx = null
    }
  }

  // Getters

  static async get(lyra: Lyra, address: string, amount: BigNumber): Promise<Stake> {
    const account = Account.get(lyra, address)
    const marketAddresses = await getMarketAddresses(lyra)
    const [accountStaking, globalEpoch, vaultTokenBalances] = await Promise.all([
      account.lyraStaking(),
      lyra.latestGlobalRewardEpoch(),
      Promise.all(marketAddresses.map(market => lyra.account(address).liquidityTokenBalance(market.optionMarket))),
    ])
    const stake = new Stake(lyra, {
      account,
      globalEpoch,
      amount,
      accountStaking,
      vaultTokenBalances,
    })
    if (stake?.tx) {
      stake.tx = await insertTxGasEstimate(lyra, stake.tx)
    }
    return stake
  }

  // Transactions

  static async approve(lyra: Lyra, account: string): Promise<PopulatedTransaction> {
    const proxyContract = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.LyraStakingModuleProxy)
    const lyraContract = getERC20Contract(
      lyra.provider,
      lyra.deployment === Deployment.Mainnet ? LYRA_OPTIMISM_MAINNET_ADDRESS : LYRA_OPTIMISM_KOVAN_ADDRESS
    )
    const data = lyraContract.interface.encodeFunctionData('approve', [proxyContract.address, MAX_BN])
    const tx = await buildTxWithGasEstimate(lyra, lyraContract.address, account, data)
    return tx
  }

  // Dynamic Fields

  vaultApy(marketAddressOrName: string): GlobalRewardEpochAPY {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const currStakedLyraBalance = fromBigNumber(this.stakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    if (currVaultTokenBalance === 0) {
      return this.globalEpoch.minVaultApy(marketAddressOrName)
    } else {
      return this.globalEpoch.vaultApy(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
    }
  }

  vaultApyMultiplier(marketAddressOrName: string): number {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const currStakedLyraBalance = fromBigNumber(this.stakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    if (currVaultTokenBalance === 0) {
      return 1
    } else {
      return this.globalEpoch.vaultApyMultiplier(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
    }
  }

  newVaultApy(marketAddressOrName: string): GlobalRewardEpochAPY {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const newStakedLyraBalance = fromBigNumber(this.newStakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    if (currVaultTokenBalance === 0) {
      return this.globalEpoch.minVaultApy(marketAddressOrName)
    } else {
      return this.globalEpoch.vaultApy(marketAddressOrName, newStakedLyraBalance, currVaultTokenBalance)
    }
  }

  newVaultApyMultiplier(marketAddressOrName: string): number {
    const market = findMarket(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const newStakedLyraBalance = fromBigNumber(this.newStakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    if (currVaultTokenBalance === 0) {
      return 1
    } else {
      return this.globalEpoch.vaultApyMultiplier(marketAddressOrName, newStakedLyraBalance, currVaultTokenBalance)
    }
  }
}
