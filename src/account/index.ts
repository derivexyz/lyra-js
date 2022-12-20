import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { CollateralUpdateEvent } from '../collateral_update_event'
import { MAX_BN, ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import {
  Deployment,
  LYRA_OPTIMISM_KOVAN_ADDRESS,
  LYRA_OPTIMISM_MAINNET_ADDRESS,
  LyraContractId,
  LyraMarketContractId,
  OP_OPTIMISM_MAINNET_ADDRESS,
  STAKED_LYRA_OPTIMISM_ADDRESS,
  STAKED_LYRA_OPTIMISM_KOVAN_ADDRESS,
} from '../constants/contracts'
import { TokenTransfer } from '../constants/queries'
import { LiquidityDeposit } from '../liquidity_deposit'
import { LiquidityWithdrawal } from '../liquidity_withdrawal'
import Lyra from '../lyra'
import { LyraStake } from '../lyra_stake'
import { LyraStaking } from '../lyra_staking'
import { LyraUnstake } from '../lyra_unstake'
import { Market } from '../market'
import { Position } from '../position'
import { SettleEvent } from '../settle_event'
import { TradeEvent } from '../trade_event'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import callContractWithMulticall from '../utils/callContractWithMulticall'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraContract from '../utils/getLyraContract'
import getLyraContractAddress from '../utils/getLyraContractAddress'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getUniqueBy from '../utils/getUniqueBy'
import isTokenEqual from '../utils/isTokenEqual'
import toBigNumber from '../utils/toBigNumber'
import fetchAccountBalancesAndAllowances from './fetchAccountBalancesAndAllowances'
import fetchPortfolioBalance from './fetchPortfolioBalance'
import fetchPortfolioHistory from './fetchPortfolioHistory'
import getAverageCostPerLPToken from './getAverageCostPerLPToken'

export type AccountTokenBalance = {
  address: string
  symbol: string
  decimals: number
  balance: BigNumber
  id: number
}

export type AccountPortfolioBalance = {
  longOptionValue: number
  shortOptionValue: number
  baseCollateralValue: number
  baseAccountValue: number
  stableCollateralValue: number
  stableAccountValue: number
  totalValue: number
  baseAccountBalances: {
    marketAddress: string
    address: string
    symbol: string
    decimals: number
    balance: BigNumber
    spotPrice: BigNumber
    value: BigNumber
  }[]
  stableAccountBalances: {
    address: string
    symbol: string
    decimals: number
    balance: BigNumber
  }[]
  positions: Position[]
}

export type AccountPortfolioSnapshot = {
  timestamp: number
  blockNumber: number
  longOptionValue: number
  shortOptionValue: number
  baseCollateralValue: number
  baseAccountValue: number
  stableCollateralValue: number
  stableAccountValue: number
  totalValue: number
  baseAccountBalances: {
    marketAddress: string
    address: string
    symbol: string
    decimals: number
    balance: BigNumber
    spotPrice: BigNumber
    value: BigNumber
  }[]
  stableAccountBalances: {
    address: string
    symbol: string
    decimals: number
    balance: BigNumber
  }[]
  trades: TradeEvent[]
  collateralUpdates: CollateralUpdateEvent[]
  settles: SettleEvent[]
  transfers: TokenTransfer[]
}

export type StableBalanceSnapshot = {
  blockNumber: number
  timestamp: number
  balance: number
  accountBalance: number
  collateralBalance: number
  accountBalances: {
    symbol: string
    address: string
    decimals: number
    balance: BigNumber
  }[]
  trades: TradeEvent[]
  collateralUpdates: CollateralUpdateEvent[]
  settles: SettleEvent[]
}

export type BaseBalanceSnapshot = {
  blockNumber: number
  timestamp: number
  symbol: string
  address: string
  decimals: number
  marketAddress: string
  balance: BigNumber
  value: BigNumber
  accountBalance: BigNumber
  accountValue: BigNumber
  collateralBalance: BigNumber
  collateralValue: BigNumber
  spotPrice: BigNumber
  trades: TradeEvent[]
  collateralUpdates: CollateralUpdateEvent[]
  settles: SettleEvent[]
}

export type AccountPositionSnapshot = {
  blockNumber: number
  timestamp: number
  longOptionValue: BigNumber
  shortOptionValue: BigNumber
  trades: TradeEvent[]
  collateralUpdates: CollateralUpdateEvent[]
  settles: SettleEvent[]
}

export type AccountQuoteBalance = AccountTokenBalance & {
  tradeAllowance: BigNumber
  depositAllowance: BigNumber
}

export type AccountBaseBalance = AccountTokenBalance & {
  tradeAllowance: BigNumber
}

export type AccountOptionTokenBalance = {
  address: string
  isApprovedForAll: boolean
  id: number
}

export type AccountLiquidityTokenBalance = {
  address: string
  balance: BigNumber
  symbol: string
  decimals: number
}

export type AccountLiquidityDepositBalance = {
  address: string
  symbol: string
  decimals: number
  balance: BigNumber
  allowance: BigNumber
}

export type AccountBalances = {
  marketAddress: string
  marketName: string
  quoteAsset: AccountQuoteBalance
  baseAsset: AccountBaseBalance
  quoteSwapAssets: AccountQuoteBalance[]
  optionToken: AccountOptionTokenBalance
  liquidityToken: AccountLiquidityTokenBalance
}

export type AccountLyraStaking = {
  staking: LyraStaking
  lyraBalance: AccountLyraBalance
  stakedLyraBalance: AccountStakedLyraBalance
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

export type AccountLyraBalance = {
  balance: BigNumber
  stakingAllowance: BigNumber
}

export type AccountStakedLyraBalance = {
  balance: BigNumber
}

export type ClaimableBalance = {
  op: BigNumber
  stkLyra: BigNumber
  lyra: BigNumber
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

  async quoteAsset(marketAddressOrName: string, tokenAddressOrName: string): Promise<AccountQuoteBalance> {
    const accBalances = await this.marketBalances(marketAddressOrName)
    const allQuoteAssets = accBalances.quoteSwapAssets
    const quoteAsset = allQuoteAssets.find(quoteAsset => isTokenEqual(quoteAsset, tokenAddressOrName))
    if (!quoteAsset) {
      throw new Error(`Quote asset does exist`)
    }
    return quoteAsset
  }

  async baseAsset(tokenOrMarketAddressOrName: string): Promise<AccountBaseBalance> {
    const [market, balances] = await Promise.all([this.lyra.market(tokenOrMarketAddressOrName), this.balances()])
    const marketBalance = balances.find(
      balance =>
        balance.marketAddress.toLowerCase() === market.address.toLowerCase() ||
        isTokenEqual(balance.baseAsset, tokenOrMarketAddressOrName)
    )
    if (!marketBalance) {
      throw new Error(`No balances exist for market`)
    }
    return marketBalance.baseAsset
  }

  async quoteAssets() {
    const balances = await this.balances()
    const allQuoteAssets = getUniqueBy<AccountTokenBalance>(
      balances.reduce((quoteAssets, balance) => {
        return [...quoteAssets, ...balance.quoteSwapAssets]
      }, [] as AccountTokenBalance[]),
      token => token.address
    )
    return allQuoteAssets
  }

  // No allowance
  async quoteAssetBalance(quoteAddressOrName: string): Promise<AccountTokenBalance> {
    const quoteAssets = await this.quoteAssets()
    const quoteAssetBalance = quoteAssets.find(quoteAsset => isTokenEqual(quoteAsset, quoteAddressOrName))
    if (!quoteAssetBalance) {
      throw new Error(`Quote asset does not exist: ${quoteAddressOrName}`)
    }
    return {
      address: quoteAssetBalance.address,
      balance: quoteAssetBalance.balance,
      symbol: quoteAssetBalance.symbol,
      decimals: quoteAssetBalance.decimals,
      id: quoteAssetBalance.id,
    }
  }

  async baseAssetBalance(tokenOrMarketAddressOrName: string) {
    const balances = await this.balances()
    const baseAssetBalance = balances.find(
      balance =>
        [balance.baseAsset.address.toLowerCase(), balance.marketAddress.toLowerCase()].includes(
          tokenOrMarketAddressOrName.toLowerCase()
        ) || balance.baseAsset.symbol.toLowerCase() === tokenOrMarketAddressOrName.toLowerCase()
    )
    if (!baseAssetBalance) {
      throw new Error(`Base asset does not exist: ${tokenOrMarketAddressOrName}`)
    }
    return baseAssetBalance.baseAsset
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

  async lyraBalance(): Promise<AccountLyraBalance> {
    const lyraTokenContract = getERC20Contract(
      this.lyra.provider,
      this.lyra.deployment === Deployment.Mainnet ? LYRA_OPTIMISM_MAINNET_ADDRESS : LYRA_OPTIMISM_KOVAN_ADDRESS
    )
    const lyraStakingModuleProxyAddress = getLyraContractAddress(this.lyra, LyraContractId.LyraStakingModuleProxy)
    const balanceOfCallData = lyraTokenContract.interface.encodeFunctionData('balanceOf', [this.address])
    const allowanceCallData = lyraTokenContract.interface.encodeFunctionData('allowance', [
      this.address,
      lyraStakingModuleProxyAddress,
    ])

    const [[balance], [stakingAllowance]] = await callContractWithMulticall<[[BigNumber], [BigNumber]]>(this.lyra, [
      {
        callData: balanceOfCallData,
        contract: lyraTokenContract,
        functionFragment: 'balanceOf',
      },
      {
        callData: allowanceCallData,
        contract: lyraTokenContract,
        functionFragment: 'allowance',
      },
    ])
    return {
      balance,
      stakingAllowance,
    }
  }

  async stakedLyraBalance(): Promise<AccountStakedLyraBalance> {
    const stakedLyraContract = getERC20Contract(
      this.lyra.provider,
      this.lyra.deployment === Deployment.Mainnet ? STAKED_LYRA_OPTIMISM_ADDRESS : STAKED_LYRA_OPTIMISM_KOVAN_ADDRESS
    ) // BLOCK: @dillonlin change address to mainnet
    const balance = await stakedLyraContract.balanceOf(this.address)
    return {
      balance,
    }
  }

  async claimableRewards(): Promise<ClaimableBalance> {
    const distributorContract = getLyraContract(this.lyra, LyraContractId.MultiDistributor)
    const stkLyraAddress = getAddress(
      this.lyra.deployment === Deployment.Mainnet ? STAKED_LYRA_OPTIMISM_ADDRESS : STAKED_LYRA_OPTIMISM_KOVAN_ADDRESS
    )
    const lyraAddress = getAddress(
      this.lyra.deployment === Deployment.Mainnet ? LYRA_OPTIMISM_MAINNET_ADDRESS : LYRA_OPTIMISM_KOVAN_ADDRESS
    )
    const opAddress =
      this.lyra.deployment === Deployment.Mainnet ? OP_OPTIMISM_MAINNET_ADDRESS : LYRA_OPTIMISM_KOVAN_ADDRESS
    const [lyraClaimableBalance, stkLyraClaimableBalance, opClaimableBalance] = await Promise.all([
      distributorContract.claimableBalances(this.address, lyraAddress),
      distributorContract.claimableBalances(this.address, stkLyraAddress),
      distributorContract.claimableBalances(this.address, opAddress),
    ])
    return {
      lyra: lyraClaimableBalance ?? BigNumber.from(10),
      stkLyra: stkLyraClaimableBalance ?? ZERO_BN,
      op: opClaimableBalance ?? ZERO_BN,
    }
  }

  async claim(tokenAddresses: string[]): Promise<PopulatedTransaction> {
    const distributorContract = getLyraContract(this.lyra, LyraContractId.MultiDistributor)
    const calldata = distributorContract.interface.encodeFunctionData('claim', [tokenAddresses])
    return await buildTxWithGasEstimate(this.lyra, distributorContract.address, this.address, calldata)
  }

  // Approval

  async approveOptionToken(marketAddressOrName: string, isAllowed: boolean): Promise<PopulatedTransaction> {
    const market = await Market.get(this.lyra, marketAddressOrName)
    const optionToken = getLyraMarketContract(this.lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
    const wrapper = getLyraContract(this.lyra, LyraContractId.OptionMarketWrapper)
    const data = optionToken.interface.encodeFunctionData('setApprovalForAll', [wrapper.address, isAllowed])
    const tx = await buildTxWithGasEstimate(this.lyra, optionToken.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for setApprovalForAll transaction')
    }
    return tx
  }

  async approveStableToken(tokenAddressOrName: string, amount: BigNumber): Promise<PopulatedTransaction> {
    const stable = await this.quoteAssetBalance(tokenAddressOrName)
    const wrapper = getLyraContract(this.lyra, LyraContractId.OptionMarketWrapper)
    const erc20 = getERC20Contract(this.lyra.provider, stable.address)
    const data = erc20.interface.encodeFunctionData('approve', [wrapper.address, amount])
    const tx = await buildTxWithGasEstimate(this.lyra, erc20.address, this.address, data)
    return tx
  }

  async approveBaseToken(tokenOrMarketAddressOrName: string, amount: BigNumber): Promise<PopulatedTransaction> {
    const stable = await this.baseAssetBalance(tokenOrMarketAddressOrName)
    const wrapper = getLyraContract(this.lyra, LyraContractId.OptionMarketWrapper)
    const erc20 = getERC20Contract(this.lyra.provider, stable.address)
    const data = erc20.interface.encodeFunctionData('approve', [wrapper.address, amount])
    const tx = await buildTxWithGasEstimate(this.lyra, erc20.address, this.address, data)
    return tx
  }

  async drip(): Promise<PopulatedTransaction> {
    if (this.lyra.deployment !== Deployment.Testnet) {
      throw new Error('Faucet is only supported on testnet contracts')
    }
    const faucet = getLyraContract(this.lyra, LyraContractId.TestFaucet)
    const data = faucet.interface.encodeFunctionData('drip')
    const tx = await buildTxWithGasEstimate(this.lyra, faucet.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for drip transaction')
    }
    return tx
  }

  async approveDeposit(marketAddressOrName: string, amount: BigNumber): Promise<PopulatedTransaction> {
    const market = await Market.get(this.lyra, marketAddressOrName)
    const quoteToken = await this.quoteAssetBalance(market.quoteToken.address)
    const liquidityPoolContract = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      LyraMarketContractId.LiquidityPool
    )
    const erc20 = getERC20Contract(this.lyra.provider, quoteToken.address)
    const data = erc20.interface.encodeFunctionData('approve', [liquidityPoolContract.address, amount])
    const tx = await buildTxWithGasEstimate(this.lyra, erc20.address, this.address, data)
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
    const lyraStakingModuleProxyContract = getLyraContract(this.lyra, LyraContractId.LyraStakingModuleProxy)
    const [block, lyraBalance, stakedLyraBalance, staking, accountCooldownBN] = await Promise.all([
      this.lyra.provider.getBlock('latest'),
      this.lyraBalance(),
      this.stakedLyraBalance(),
      this.lyra.lyraStaking(),
      lyraStakingModuleProxyContract.stakersCooldowns(this.address),
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
      lyraBalance,
      stakedLyraBalance,
      isInUnstakeWindow,
      isInCooldown,
      unstakeWindowStartTimestamp,
      unstakeWindowEndTimestamp,
    }
  }

  async wethLyraStaking(): Promise<AccountWethLyraStaking> {
    const [gelatoPoolContract, wethLyraStakingRewardsContract] = await Promise.all([
      getLyraContract(this.lyra, LyraContractId.ArrakisPool),
      getLyraContract(this.lyra, LyraContractId.WethLyraStakingRewards),
    ])
    const [unstakedLPTokenBalance, allowance, stakedLPTokenBalance, rewards, latestGlobalRewardEpoch] =
      await Promise.all([
        gelatoPoolContract.balanceOf(this.address),
        gelatoPoolContract.allowance(this.address, wethLyraStakingRewardsContract.address),
        wethLyraStakingRewardsContract.balanceOf(this.address),
        wethLyraStakingRewardsContract.earned(this.address), // @dillon: keep this here for now because some people are yet to claim from old system
        this.lyra.latestGlobalRewardEpoch(),
      ])
    const opRewards = toBigNumber(
      (await latestGlobalRewardEpoch.accountRewardEpoch(this.address))?.wethLyraStaking.opRewards ?? 0
    )
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

  async stakeWethLyra(amount: BigNumber): Promise<PopulatedTransaction> {
    const wethLyraStakingRewardsContract = getLyraContract(this.lyra, LyraContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('stake', [amount])
    return await buildTxWithGasEstimate(this.lyra, wethLyraStakingRewardsContract.address, this.address, calldata)
  }

  async unstakeWethLyra(amount: BigNumber) {
    const wethLyraStakingRewardsContract = getLyraContract(this.lyra, LyraContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('withdraw', [amount])
    return await buildTxWithGasEstimate(this.lyra, wethLyraStakingRewardsContract.address, this.address, calldata)
  }

  async approveWethLyraTokens(): Promise<PopulatedTransaction> {
    const gelatoPoolContract = getLyraContract(this.lyra, LyraContractId.ArrakisPool)
    const wethLyraStakingRewardsContractAddress = getLyraContractAddress(
      this.lyra,
      LyraContractId.WethLyraStakingRewards
    )
    const calldata = gelatoPoolContract.interface.encodeFunctionData('approve', [
      wethLyraStakingRewardsContractAddress,
      MAX_BN,
    ])
    return await buildTxWithGasEstimate(this.lyra, gelatoPoolContract.address, this.address, calldata)
  }

  async claimWethLyraRewards() {
    const wethLyraStakingRewardsContract = getLyraContract(this.lyra, LyraContractId.WethLyraStakingRewards)
    const calldata = wethLyraStakingRewardsContract.interface.encodeFunctionData('getReward')
    return await buildTxWithGasEstimate(this.lyra, wethLyraStakingRewardsContract.address, this.address, calldata)
  }

  // Edges

  async liquidityDeposits(marketAddressOrName: string): Promise<LiquidityDeposit[]> {
    return await this.lyra.liquidityDeposits(marketAddressOrName, this.address)
  }

  async liquidityWithdrawals(marketAddressOrName: string): Promise<LiquidityWithdrawal[]> {
    return await this.lyra.liquidityWithdrawals(marketAddressOrName, this.address)
  }

  async portfolioHistory(startTimestamp: number): Promise<AccountPortfolioSnapshot[]> {
    return await fetchPortfolioHistory(this.lyra, this.address, startTimestamp)
  }

  async portfolioBalance(): Promise<AccountPortfolioBalance> {
    return await fetchPortfolioBalance(this.lyra, this.address)
  }
}
