import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { Account, AccountBalances, AccountLiquidityTokenBalance, AccountLyraStaking } from '..'
import { MAX_BN, ZERO_BN } from '../constants/bn'
import {
  LYRA_ETHEREUM_KOVAN_ADDRESS,
  LYRA_ETHEREUM_MAINNET_ADDRESS,
  LyraGlobalContractId,
} from '../constants/contracts'
import { SECONDS_IN_DAY } from '../constants/time'
import { GlobalRewardEpoch, RewardEpochTokenAmount } from '../global_reward_epoch'
import Lyra, { Deployment } from '../lyra'
import buildTx from '../utils/buildTx'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import findMarketX from '../utils/findMarketX'
import fromBigNumber from '../utils/fromBigNumber'
import getERC20Contract from '../utils/getERC20Contract'
import getGlobalContract from '../utils/getGlobalContract'
import insertTxGasEstimate from '../utils/insertTxGasEstimate'

type StakeData = {
  account: Account
  accountStaking: AccountLyraStaking
  globalEpoch: GlobalRewardEpoch | null
  accountBalances: AccountBalances[]
  amount: BigNumber
}

export enum StakeDisabledReason {
  InsufficientBalance = 'InsufficientBalance',
  InsufficientAllowance = 'InsufficientAllowance',
  ZeroAmount = 'ZeroAmount',
}

export class LyraStake {
  lyra: Lyra
  private vaultTokenBalances: Record<string, AccountLiquidityTokenBalance>
  globalEpoch: GlobalRewardEpoch | null
  accountStaking: AccountLyraStaking
  account: Account
  amount: BigNumber
  lyraBalance: BigNumber
  stakedLyraBalance: BigNumber
  allowance: BigNumber
  // Derived
  newStakedLyraBalance: BigNumber
  newStakingYieldPerDay: RewardEpochTokenAmount[]
  stakingYieldPerDay: RewardEpochTokenAmount[]
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
    this.lyraBalance = data.accountStaking.lyraBalances.ethereumLyra
    this.stakedLyraBalance = data.accountStaking.lyraBalances.ethereumStkLyra
    this.newStakedLyraBalance = this.stakedLyraBalance.add(this.amount)
    this.allowance = data.accountStaking.lyraAllowances.stakingAllowance

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
      const lyraStakingModuleProxyContract = getGlobalContract(
        lyra,
        LyraGlobalContractId.LyraStakingModule,
        lyra.ethereumProvider
      )
      const txData = lyraStakingModuleProxyContract.interface.encodeFunctionData('stake', [
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

  static async get(lyra: Lyra, address: string, amount: BigNumber): Promise<LyraStake> {
    const account = Account.get(lyra, address)
    const [accountStaking, globalEpoch, balances] = await Promise.all([
      account.lyraStaking(),
      lyra.latestGlobalRewardEpoch(),
      lyra.account(address).balances(),
    ])
    const stake = new LyraStake(lyra, {
      account,
      globalEpoch,
      amount,
      accountStaking,
      accountBalances: balances,
    })
    if (stake?.tx) {
      stake.tx = await insertTxGasEstimate(lyra.ethereumProvider ?? lyra.provider, stake.tx)
    }
    return stake
  }

  // Transactions

  static async approve(lyra: Lyra, account: string): Promise<PopulatedTransaction> {
    const proxyContract = getGlobalContract(lyra, LyraGlobalContractId.LyraStakingModule, lyra.ethereumProvider)

    const lyraContract = getERC20Contract(
      lyra.ethereumProvider ?? lyra.provider,
      lyra.deployment === Deployment.Mainnet ? LYRA_ETHEREUM_MAINNET_ADDRESS : LYRA_ETHEREUM_KOVAN_ADDRESS
    )
    const data = lyraContract.interface.encodeFunctionData('approve', [proxyContract.address, MAX_BN])
    const tx = await buildTxWithGasEstimate(
      lyra.ethereumProvider ?? lyra.provider,
      1,
      lyraContract.address,
      account,
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
    if (currVaultTokenBalance === 0) {
      return this.globalEpoch.minVaultApy(marketAddressOrName)
    } else {
      return this.globalEpoch.vaultApy(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
    }
  }

  vaultApyMultiplier(marketAddressOrName: string): number {
    if (!this.globalEpoch) {
      return 1
    }
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
    const marketKey = market.baseToken.symbol
    const currStakedLyraBalance = fromBigNumber(this.stakedLyraBalance)
    const currVaultTokenBalance = fromBigNumber(this.vaultTokenBalances[marketKey].balance)
    if (currVaultTokenBalance === 0) {
      return 1
    } else {
      return this.globalEpoch.vaultApyMultiplier(marketAddressOrName, currStakedLyraBalance, currVaultTokenBalance)
    }
  }

  newVaultApy(marketAddressOrName: string): RewardEpochTokenAmount[] {
    if (!this.globalEpoch) {
      return []
    }
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
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
    if (!this.globalEpoch) {
      return 1
    }
    const market = findMarketX(this.globalEpoch.markets, marketAddressOrName)
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
