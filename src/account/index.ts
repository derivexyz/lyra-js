import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { MAX_BN, ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import {
  Deployment,
  LYRA_ETHEREUM_MAINNET_ADDRESS,
  LYRA_OPTIMISM_KOVAN_ADDRESS,
  LyraContractId,
  LyraGlobalContractId,
  LyraMarketContractId,
  NEW_STAKED_LYRA_OPTIMISM_ADDRESS,
  OLD_STAKED_LYRA_OPTIMISM_ADDRESS,
  OP_OPTIMISM_MAINNET_ADDRESS,
} from '../constants/contracts'
import { LiquidityDeposit } from '../liquidity_deposit'
import { LiquidityWithdrawal } from '../liquidity_withdrawal'
import Lyra from '../lyra'
import { LyraStake } from '../lyra_stake'
import { LyraStaking } from '../lyra_staking'
import { LyraUnstake } from '../lyra_unstake'
import { Market } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fetchLyraBalances from '../utils/fetchLyraBalances'
import getERC20Contract from '../utils/getERC20Contract'
import getGlobalContract from '../utils/getGlobalContract'
import getLyraContract from '../utils/getLyraContract'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import toBigNumber from '../utils/toBigNumber'
import fetchAccountBalancesAndAllowances from './fetchAccountBalancesAndAllowances'
import getAverageCostPerLPToken from './getAverageCostPerLPToken'

export type AccountTokenBalance = {
  address: string
  symbol: string
  decimals: number
  balance: BigNumber
}

export type AccountQuoteBalance = AccountTokenBalance & {
  tradeAllowance: BigNumber
  depositAllowance: BigNumber
}

export type AccountBaseBalance = AccountTokenBalance & {
  tradeAllowance: BigNumber
}

export type AccountLiquidityTokenBalance = AccountTokenBalance

export type AccountBalances = {
  owner: string
  market: Market
  marketAddress: string
  marketName: string
  quoteAsset: AccountQuoteBalance
  baseAsset: AccountBaseBalance
  liquidityToken: AccountLiquidityTokenBalance
}

export type AccountLyraStaking = {
  staking: LyraStaking
  lyraBalances: AccountLyraBalances
  lyraAllowances: AccountLyraAllowances
  isInUnstakeWindow: boolean
  isInCooldown: boolean
  unstakeWindowStartTimestamp: number | null
  unstakeWindowEndTimestamp: number | null
}

export type AccountWethLyraStaking = {
  unstakedLPTokenBalance: BigNumber
  stakedLPTokenBalance: BigNumber
  rewards: BigNumber
  opRewards: BigNumber
  allowance: BigNumber
}

export type AccountLyraBalances = {
  ethereumLyra: BigNumber
  optimismLyra: BigNumber
  optimismOldStkLyra: BigNumber
  ethereumStkLyra: BigNumber
  optimismStkLyra: BigNumber
}

export type AccountLyraAllowances = {
  stakingAllowance: BigNumber
  migrationAllowance: BigNumber
}

export type ClaimableBalanceL2 = {
  op: BigNumber
  oldStkLyra: BigNumber
  newStkLyra: BigNumber
}

export type ClaimableBalanceL1 = {
  newStkLyra: BigNumber
}

export class Account {
  private lyra: Lyra
  address: string

  constructor(lyra: Lyra, address: string) {
    this.lyra = lyra
    this.address = address
  }

  // Getters

  static get(lyra: Lyra, account: string): Account {
    return new Account(lyra, account)
  }

  // Dynamic Fields

  async balances(): Promise<AccountBalances[]> {
    return await fetchAccountBalancesAndAllowances(this.lyra, this.address)
  }

  async marketBalances(marketAddressOrName: string): Promise<AccountBalances> {
    const [market, balances] = await Promise.all([this.lyra.market(marketAddressOrName), this.balances()])
    const balance = balances.find(balance => balance.marketAddress.toLowerCase() === market.address.toLowerCase())
    if (!balance) {
      throw new Error(`No balances exist for market`)
    }
    return balance
  }

  async liquidityUnrealizedPnl(marketAddressOrName: string): Promise<{ pnl: BigNumber; pnlPercent: BigNumber }> {
    const [market, balance, liquidityDeposits, liquidityWithdrawals] = await Promise.all([
      this.lyra.market(marketAddressOrName),
      this.marketBalances(marketAddressOrName),
      this.lyra.liquidityDeposits(marketAddressOrName, this.address),
      this.lyra.liquidityWithdrawals(marketAddressOrName, this.address),
    ])
    if (!balance) {
      throw new Error('No balance found for market')
    }
    const marketLiquidity = await market.liquidity()
    const value = marketLiquidity.tokenPrice.mul(balance.liquidityToken.balance).div(UNIT)
    const avgCostPerToken = getAverageCostPerLPToken(liquidityDeposits, liquidityWithdrawals)
    const avgValue = avgCostPerToken.mul(balance.liquidityToken.balance).div(UNIT)
    const pnl = value.sub(avgValue)
    const pnlPercent = avgCostPerToken.gt(0)
      ? marketLiquidity.tokenPrice.mul(UNIT).div(avgCostPerToken).sub(ONE_BN)
      : ZERO_BN
    return {
      pnl,
      pnlPercent,
    }
  }

  async lyraBalances(): Promise<AccountLyraBalances> {
    const lyraBalances = await fetchLyraBalances(this.address)
    return {
      ethereumLyra: lyraBalances.mainnetLYRA,
      optimismLyra: lyraBalances.opLYRA,
      optimismOldStkLyra: lyraBalances.opOldStkLYRA,
      ethereumStkLyra: lyraBalances.mainnetStkLYRA,
      optimismStkLyra: lyraBalances.opStkLYRA,
    }
  }

  async lyraStakingAllowance(): Promise<BigNumber> {
    if (!this.lyra.ethereumProvider) {
      throw new Error('Ethereum provider required.')
    }
    const lyraTokenContract = getERC20Contract(this.lyra.ethereumProvider, LYRA_ETHEREUM_MAINNET_ADDRESS)
    const lyraStakingModuleContract = getGlobalContract(
      this.lyra,
      LyraGlobalContractId.LyraStakingModule,
      this.lyra.ethereumProvider
    )
    return await lyraTokenContract.allowance(this.address, lyraStakingModuleContract.address)
  }

  async stkLyraMigrationAllowance(): Promise<BigNumber> {
    if (!this.lyra.optimismProvider) {
      throw new Error('Optimism provider required.')
    }
    const oldStakedLyraContract = getERC20Contract(this.lyra.optimismProvider, OLD_STAKED_LYRA_OPTIMISM_ADDRESS)
    const tokenMigratorContract = getGlobalContract(
      this.lyra,
      LyraGlobalContractId.TokenMigrator,
      this.lyra.optimismProvider
    )
    return await oldStakedLyraContract.allowance(this.address, tokenMigratorContract.address)
  }

  async lyraAllowances(): Promise<AccountLyraAllowances> {
    const [stakingAllowance, migrationAllowance] = await Promise.all([
      this.lyraStakingAllowance(),
      this.stkLyraMigrationAllowance(),
    ])
    return {
      stakingAllowance,
      migrationAllowance,
    }
  }

  async claimableRewardsL1(): Promise<ClaimableBalanceL1> {
    const stakingRewardsClaimableBalance = await LyraStaking.getStakingRewardsBalance(this.lyra, this.address)
    return {
      newStkLyra: stakingRewardsClaimableBalance,
    }
  }

  async claimableRewardsL2(): Promise<ClaimableBalanceL2> {
    const distributorContract = getGlobalContract(this.lyra, LyraGlobalContractId.MultiDistributor)
    const newStkLyraAddress = getAddress(NEW_STAKED_LYRA_OPTIMISM_ADDRESS)
    const oldStkLyraAddress = getAddress(OLD_STAKED_LYRA_OPTIMISM_ADDRESS)
    const opAddress =
      this.lyra.deployment === Deployment.Mainnet ? OP_OPTIMISM_MAINNET_ADDRESS : LYRA_OPTIMISM_KOVAN_ADDRESS
    const [newStkLyraClaimableBalance, oldStkLyraClaimableBalance, opClaimableBalance] = await Promise.all([
      distributorContract.claimableBalances(this.address, newStkLyraAddress),
      distributorContract.claimableBalances(this.address, oldStkLyraAddress),
      distributorContract.claimableBalances(this.address, opAddress),
    ])
    return {
      newStkLyra: newStkLyraClaimableBalance ?? ZERO_BN,
      oldStkLyra: oldStkLyraClaimableBalance ?? ZERO_BN,
      op: opClaimableBalance ?? ZERO_BN,
    }
  }

  async claim(tokenAddresses: string[]): Promise<PopulatedTransaction> {
    const distributorContract = getGlobalContract(this.lyra, LyraGlobalContractId.MultiDistributor)
    const calldata = distributorContract.interface.encodeFunctionData('claim', [tokenAddresses])
    return await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      distributorContract.address,
      this.address,
      calldata
    )
  }

  // Approval

  async drip(): Promise<PopulatedTransaction> {
    if (this.lyra.deployment !== Deployment.Testnet) {
      throw new Error('Faucet is only supported on testnet contracts')
    }
    const faucet = getLyraContract(this.lyra, this.lyra.version, LyraContractId.TestFaucet)
    const data = faucet.interface.encodeFunctionData('drip')
    const tx = await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      faucet.address,
      this.address,
      data
    )
    if (!tx) {
      throw new Error('Failed to estimate gas for drip transaction')
    }
    return tx
  }

  async approveDeposit(marketAddressOrName: string, amount: BigNumber): Promise<PopulatedTransaction> {
    const market = await Market.get(this.lyra, marketAddressOrName)
    const liquidityPoolContract = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const erc20 = getERC20Contract(this.lyra.provider, market.quoteToken.address)
    const data = erc20.interface.encodeFunctionData('approve', [liquidityPoolContract.address, amount])
    const tx = await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      erc20.address,
      this.address,
      data
    )
    return tx
  }

  async deposit(
    marketAddressOrName: string,
    beneficiary: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction | null> {
    return await LiquidityDeposit.deposit(this.lyra, marketAddressOrName, beneficiary, amountQuote)
  }

  async withdraw(
    marketAddressOrName: string,
    beneficiary: string,
    amountLiquidityTokens: BigNumber
  ): Promise<PopulatedTransaction | null> {
    return await LiquidityWithdrawal.withdraw(this.lyra, marketAddressOrName, beneficiary, amountLiquidityTokens)
  }

  async lyraStaking(): Promise<AccountLyraStaking> {
    const lyraStakingModuleContract = getGlobalContract(
      this.lyra,
      LyraGlobalContractId.LyraStakingModule,
      this.lyra.ethereumProvider
    )
    const [block, lyraBalances, lyraAllowances, staking, accountCooldownBN] = await Promise.all([
      this.lyra.provider.getBlock('latest'),
      this.lyraBalances(),
      this.lyraAllowances(),
      this.lyra.lyraStaking(),
      lyraStakingModuleContract.stakersCooldowns(this.address),
    ])
    const accountCooldown = accountCooldownBN.toNumber()
    const cooldownStartTimestamp = accountCooldown > 0 ? accountCooldown : null
    const cooldownEndTimestamp = accountCooldown > 0 ? accountCooldown + staking.cooldownPeriod : null
    const unstakeWindowStartTimestamp = cooldownEndTimestamp
    const unstakeWindowEndTimestamp = unstakeWindowStartTimestamp
      ? unstakeWindowStartTimestamp + staking.unstakeWindow
      : null
    const isInUnstakeWindow =
      !!unstakeWindowStartTimestamp &&
      !!unstakeWindowEndTimestamp &&
      block.timestamp >= unstakeWindowStartTimestamp &&
      block.timestamp <= unstakeWindowEndTimestamp
    const isInCooldown =
      !!cooldownStartTimestamp &&
      !!cooldownEndTimestamp &&
      block.timestamp >= cooldownStartTimestamp &&
      block.timestamp <= cooldownEndTimestamp
    return {
      staking,
      lyraBalances,
      lyraAllowances,
      isInUnstakeWindow,
      isInCooldown,
      unstakeWindowStartTimestamp,
      unstakeWindowEndTimestamp,
    }
  }

  async wethLyraStaking(): Promise<AccountWethLyraStaking> {
    const [gelatoPoolContract, wethLyraStakingRewardsContract] = await Promise.all([
      getGlobalContract(this.lyra, LyraGlobalContractId.ArrakisPool, this.lyra.optimismProvider),
      getGlobalContract(this.lyra, LyraGlobalContractId.WethLyraStakingRewards, this.lyra.optimismProvider),
    ])
    const [unstakedLPTokenBalance, allowance, stakedLPTokenBalance, rewards, latestGlobalRewardEpoch] =
      await Promise.all([
        gelatoPoolContract.balanceOf(this.address),
        gelatoPoolContract.allowance(this.address, wethLyraStakingRewardsContract.address),
        wethLyraStakingRewardsContract.balanceOf(this.address),
        wethLyraStakingRewardsContract.earned(this.address), // @dillon: keep this here for now because some people are yet to claim from old system
        this.lyra.latestGlobalRewardEpoch(),
      ])
    const accountRewardEpoch = await latestGlobalRewardEpoch?.accountRewardEpoch(this.address)
    const opRewardsAmount =
      accountRewardEpoch?.wethLyraStaking?.rewards?.find(token => token.symbol.toLowerCase() === 'op')?.amount ?? 0
    const opRewards = toBigNumber(opRewardsAmount)
    return {
      unstakedLPTokenBalance,
      allowance,
      stakedLPTokenBalance,
      rewards: rewards,
      opRewards: opRewards,
    }
  }

  async approveStake(): Promise<PopulatedTransaction> {
    return await LyraStake.approve(this.lyra, this.address)
  }

  async stake(amount: BigNumber): Promise<LyraStake> {
    return await LyraStake.get(this.lyra, this.address, amount)
  }

  async requestUnstake(): Promise<PopulatedTransaction> {
    return await LyraUnstake.requestUnstake(this.lyra, this.address)
  }

  async unstake(amount: BigNumber): Promise<LyraUnstake> {
    return await LyraUnstake.get(this.lyra, this.address, amount)
  }

  async claimStakedLyraRewards(): Promise<PopulatedTransaction> {
    return await LyraStaking.claimRewards(this.lyra, this.address)
  }

  async stakeWethLyra(amount: BigNumber): Promise<PopulatedTransaction> {
    const wethLyraStakingRewardsContract = getGlobalContract(this.lyra, LyraGlobalContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('stake', [amount])
    return await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      wethLyraStakingRewardsContract.address,
      this.address,
      calldata
    )
  }

  async unstakeWethLyra(amount: BigNumber) {
    const wethLyraStakingRewardsContract = getGlobalContract(this.lyra, LyraGlobalContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('withdraw', [amount])
    return await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      wethLyraStakingRewardsContract.address,
      this.address,
      calldata
    )
  }

  async approveWethLyraTokens(): Promise<PopulatedTransaction> {
    const gelatoPoolContract = getGlobalContract(this.lyra, LyraGlobalContractId.ArrakisPool)
    const wethLyraStakingContract = getGlobalContract(this.lyra, LyraGlobalContractId.WethLyraStakingRewards)
    const calldata = gelatoPoolContract.interface.encodeFunctionData('approve', [
      wethLyraStakingContract.address,
      MAX_BN,
    ])
    return await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      gelatoPoolContract.address,
      this.address,
      calldata
    )
  }

  async claimWethLyraRewards() {
    const wethLyraStakingRewardsContract = getGlobalContract(this.lyra, LyraGlobalContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('getReward')
    return await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      wethLyraStakingRewardsContract.address,
      this.address,
      calldata
    )
  }

  async approveMigrateStakedLyra(): Promise<PopulatedTransaction> {
    const tokenMigratorContract = getGlobalContract(this.lyra, LyraGlobalContractId.TokenMigrator)
    const erc20 = getERC20Contract(this.lyra.provider, OLD_STAKED_LYRA_OPTIMISM_ADDRESS)
    const data = erc20.interface.encodeFunctionData('approve', [tokenMigratorContract.address, MAX_BN])
    const tx = await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      erc20.address,
      this.address,
      data
    )
    return tx
  }

  async migrateStakedLyra(): Promise<PopulatedTransaction> {
    const tokenMigratorContract = getGlobalContract(
      this.lyra,
      LyraGlobalContractId.TokenMigrator,
      this.lyra.optimismProvider
    )
    const { optimismOldStkLyra } = await this.lyraBalances()
    const data = tokenMigratorContract.interface.encodeFunctionData('swap', [optimismOldStkLyra])
    const tx = await buildTxWithGasEstimate(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      tokenMigratorContract.address,
      this.address,
      data
    )
    return tx
  }

  // Edges

  async liquidityDeposits(marketAddressOrName: string): Promise<LiquidityDeposit[]> {
    return await this.lyra.liquidityDeposits(marketAddressOrName, this.address)
  }

  async liquidityWithdrawals(marketAddressOrName: string): Promise<LiquidityWithdrawal[]> {
    return await this.lyra.liquidityWithdrawals(marketAddressOrName, this.address)
  }
}
