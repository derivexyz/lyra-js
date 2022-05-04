import { BigNumber } from '@ethersproject/bignumber'
import { ethers } from 'ethers'

import Lyra from '..'
import { Deployment, LyraContractId, LyraMarketContractId } from '../constants/contracts'
import Market from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraContract from '../utils/getLyraContract'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getAccountBalancesAndAllowances from './getAccountBalancesAndAllowances'

export type AccountStableBalance = {
  address: string
  symbol: string
  decimals: number
  balance: BigNumber
  allowance: BigNumber
}

export type AccountBaseBalance = {
  marketAddress: string
  address: string
  symbol: string
  decimals: number
  balance: BigNumber
  allowance: BigNumber
}

export type AccountOptionTokenBalance = {
  marketAddress: string
  address: string
  isApprovedForAll: boolean
}

export type AccountBalances = {
  stables: AccountStableBalance[]
  stable: (tokenAddressOrName: string) => AccountStableBalance
  bases: AccountBaseBalance[]
  base: (tokenOrMarketAddressOrName: string) => AccountBaseBalance
  optionTokens: AccountOptionTokenBalance[]
  optionToken: (tokenOrMarketAddress: string) => AccountOptionTokenBalance
  // TODO: @DillonLin Add LP token balances
}

export default class Account {
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

  async balances(): Promise<AccountBalances> {
    const markets = await Market.getAll(this.lyra)
    const { stables, bases, optionTokens } = await getAccountBalancesAndAllowances(this.lyra, this.address, markets)
    const stable = (tokenAddressOrName: string): AccountStableBalance => {
      const stable = stables.find(
        stable =>
          stable.address.toLowerCase() === tokenAddressOrName.toLowerCase() ||
          stable.symbol.toLowerCase() === tokenAddressOrName.toLowerCase()
      )
      if (!stable) {
        throw new Error('Stable token does not exist')
      }
      return stable
    }
    const base = (tokenOrMarketAddressOrName: string): AccountBaseBalance => {
      const base = bases.find(
        base =>
          [base.marketAddress.toLowerCase(), base.address.toLowerCase()].includes(
            tokenOrMarketAddressOrName.toLowerCase()
          ) || base.symbol.toLowerCase() === tokenOrMarketAddressOrName
      )
      if (!base) {
        throw new Error('Base token does not exist')
      }
      return base
    }
    const optionToken = (tokenOrMarketAddress: string): AccountOptionTokenBalance => {
      const optionToken = optionTokens.find(optionToken =>
        [optionToken.marketAddress.toLowerCase(), optionToken.address.toLowerCase()].includes(
          tokenOrMarketAddress.toLowerCase()
        )
      )
      if (!optionToken) {
        throw new Error('Option token does not exist')
      }
      return optionToken
    }
    return {
      stables,
      stable,
      bases,
      base,
      optionTokens,
      optionToken,
    }
  }

  // Approval

  async approveOptionToken(marketAddressOrName: string, isAllowed: boolean): Promise<ethers.PopulatedTransaction> {
    const market = await Market.get(this.lyra, marketAddressOrName)
    const optionToken = getLyraMarketContract(this.lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
    const wrapper = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.OptionMarketWrapper)
    const data = optionToken.interface.encodeFunctionData('setApprovalForAll', [wrapper.address, isAllowed])
    const tx = await buildTxWithGasEstimate(this.lyra, optionToken.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for setApprovalForAll transaction')
    }
    return tx
  }

  async approveStableToken(tokenAddressOrName: string, amount: BigNumber): Promise<ethers.PopulatedTransaction> {
    const balances = await this.balances()
    const stable = balances.stable(tokenAddressOrName)
    const wrapper = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.OptionMarketWrapper)
    const erc20 = getERC20Contract(this.lyra.provider, stable.address)
    const data = erc20.interface.encodeFunctionData('approve', [wrapper.address, amount])
    const tx = await buildTxWithGasEstimate(this.lyra, erc20.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for approve transaction')
    }
    return tx
  }

  async approveBaseToken(tokenOrMarketAddressOrName: string, amount: BigNumber): Promise<ethers.PopulatedTransaction> {
    const balances = await this.balances()
    const stable = balances.base(tokenOrMarketAddressOrName)
    const wrapper = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.OptionMarketWrapper)
    const erc20 = getERC20Contract(this.lyra.provider, stable.address)
    const data = erc20.interface.encodeFunctionData('approve', [wrapper.address, amount])
    const tx = await buildTxWithGasEstimate(this.lyra, erc20.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for approve transaction')
    }
    return tx
  }

  // Faucet (Local, Kovan)

  async drip(): Promise<ethers.PopulatedTransaction> {
    if (![Deployment.Kovan, Deployment.Local].includes(this.lyra.deployment)) {
      throw new Error('Faucet is only supported on local and kovan contracts')
    }
    const faucet = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.TestFaucet)
    const data = faucet.interface.encodeFunctionData('drip')
    const tx = await buildTxWithGasEstimate(this.lyra, faucet.address, this.address, data)
    if (!tx) {
      throw new Error('Failed to estimate gas for drip transaction')
    }
    return tx
  }
}
