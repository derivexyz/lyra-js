import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { Deployment, LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import buildTx from '../utils/buildTx'
import fetchLyraBalances from '../utils/fetchLyraBalances'
import getLyraContract from '../utils/getLyraContract'
import fetchAccountBalancesAndAllowances from './fetchAccountBalancesAndAllowances'

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

export type AccountLyraBalances = {
  ethereumLyra: BigNumber
  optimismLyra: BigNumber
  arbitrumLyra: BigNumber
  optimismOldStkLyra: BigNumber
  ethereumStkLyra: BigNumber
  optimismStkLyra: BigNumber
  arbitrumStkLyra: BigNumber
  stakingAllowance: BigNumber
}

export type AccountPnlSnapshot = {
  timestamp: number
  livePnl: number
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

  async lyraBalances(): Promise<AccountLyraBalances> {
    return await fetchLyraBalances(this.lyra, this.address)
  }

  drip(): PopulatedTransaction {
    if (this.lyra.deployment !== Deployment.Testnet) {
      throw new Error('Faucet is only supported on testnet contracts')
    }
    const faucet = getLyraContract(this.lyra, this.lyra.version, LyraContractId.TestFaucet)
    const data = faucet.interface.encodeFunctionData('drip')
    return buildTx(this.lyra.provider, this.lyra.provider.network.chainId, faucet.address, this.address, data)
  }
}
