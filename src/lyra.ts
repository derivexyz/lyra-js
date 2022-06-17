import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers'
import { GraphQLClient } from 'graphql-request'

import { Account } from './account'
import { Admin } from './admin'
import { Board } from './board'
import { CollateralUpdateEvent } from './collateral_update_event'
import { Deployment } from './constants/contracts'
import { LiquidityDeposit } from './liquidity_deposit'
import { LiquidityWithdrawal } from './liquidity_withdrawal'
import { Market, MarketTradeOptions } from './market'
import { Option } from './option'
import { Position } from './position'
import LyraJsonRpcProvider from './provider'
import { Quote, QuoteOptions } from './quote'
import getQuoteBoard from './quote/getQuoteBoard'
import { RewardEpoch } from './reward_epoch'
import { Staking } from './staking'
import { Strike } from './strike'
import { Trade } from './trade'
import { TradeEvent, TradeEventListener, TradeEventListenerCallback, TradeEventListenerOptions } from './trade_event'
import getLyraDeploymentChainId from './utils/getLyraDeploymentChainId'
import getLyraDeploymentForChainId from './utils/getLyraDeploymentForChainId'
import getLyraDeploymentOptimismBlockSubgraphURI from './utils/getLyraDeploymentOptimismBlockSubgraphURI'
import getLyraDeploymentRPCURL from './utils/getLyraDeploymentRPCURL'
import getLyraDeploymentSubgraphURI from './utils/getLyraDeploymentSubgraphURI'
import { SortEventOptions } from './utils/sortEvents'

export type LyraConfig = {
  rpcUrl: string
  chainId: number
  subgraphUri?: string
  blockSubgraphUri?: string
}

export { Deployment } from './constants/contracts'

export default class Lyra {
  chainId: number
  deployment: Deployment
  rpcUrl: string
  provider: JsonRpcProvider
  subgraphUri: string
  subgraphClient: GraphQLClient
  blockSubgraphUri: string
  blockSubgraphClient: GraphQLClient
  constructor(config: LyraConfig | Deployment | number = Deployment.Mainnet, disableCache?: boolean) {
    if (typeof config === 'object') {
      // LyraConfig
      const configObj = config as LyraConfig
      this.chainId = configObj.chainId
      this.deployment = getLyraDeploymentForChainId(this.chainId)
      this.rpcUrl = configObj?.rpcUrl ?? getLyraDeploymentRPCURL(this.deployment)
      this.subgraphUri = configObj?.subgraphUri ?? getLyraDeploymentSubgraphURI(this.deployment)
      this.blockSubgraphUri = configObj?.blockSubgraphUri ?? getLyraDeploymentOptimismBlockSubgraphURI(this.deployment)
    } else if (typeof config === 'number') {
      // Chain ID
      this.chainId = config
      this.deployment = getLyraDeploymentForChainId(this.chainId)
      this.rpcUrl = getLyraDeploymentRPCURL(this.deployment)
      this.subgraphUri = getLyraDeploymentSubgraphURI(this.deployment)
      this.blockSubgraphUri = getLyraDeploymentOptimismBlockSubgraphURI(this.deployment)
    } else {
      // String
      this.deployment = config
      this.chainId = getLyraDeploymentChainId(this.deployment)
      this.rpcUrl = getLyraDeploymentRPCURL(this.deployment)
      this.subgraphUri = getLyraDeploymentSubgraphURI(this.deployment)
      this.blockSubgraphUri = getLyraDeploymentOptimismBlockSubgraphURI(this.deployment)
    }

    this.provider =
      this.deployment === Deployment.Local || disableCache
        ? new StaticJsonRpcProvider({ url: this.rpcUrl, throttleLimit: 1 }, this.chainId)
        : new LyraJsonRpcProvider({ url: this.rpcUrl, throttleLimit: 1 }, this.chainId)

    this.subgraphClient = new GraphQLClient(this.subgraphUri)
    this.blockSubgraphClient = new GraphQLClient(this.blockSubgraphUri)

    console.debug('Lyra', {
      deployment: this.deployment,
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
      subgraphUri: this.subgraphUri,
      blockSubgraphUri: this.blockSubgraphUri,
    })
  }

  // Quote

  async quote(
    marketAddressOrName: string,
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<Quote> {
    const market = await this.market(marketAddressOrName)
    return await market.quote(strikeId, isCall, isBuy, size, options)
  }

  async quoteBoard(
    marketAddressOrName: string,
    boardId: number,
    size: BigNumber
  ): Promise<{ bid: Quote; ask: Quote; option: Option }[]> {
    const board = await this.board(marketAddressOrName, boardId)
    return getQuoteBoard(board, size)
  }

  // Trade

  async trade(
    owner: string,
    marketAddressOrName: string,
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    options?: MarketTradeOptions
  ): Promise<Trade> {
    const market = await this.market(marketAddressOrName)
    return await market.trade(owner, strikeId, isCall, isBuy, size, slippage, options)
  }

  onTrade(callback: TradeEventListenerCallback, options?: TradeEventListenerOptions): TradeEventListener {
    return TradeEvent.on(this, callback, options)
  }

  // Market

  async markets(): Promise<Market[]> {
    return await Market.getAll(this)
  }

  async market(marketAddressOrName: string): Promise<Market> {
    return await Market.get(this, marketAddressOrName)
  }

  async board(marketAddressOrName: string, boardId: number): Promise<Board> {
    return await Board.get(this, marketAddressOrName, boardId)
  }

  async strike(marketAddressOrName: string, strikeId: number): Promise<Strike> {
    return await Strike.get(this, marketAddressOrName, strikeId)
  }

  async option(marketAddressOrName: string, strikeId: number, isCall: boolean): Promise<Option> {
    return await Option.get(this, marketAddressOrName, strikeId, isCall)
  }

  // Position

  async openPositions(owner: string): Promise<Position[]> {
    return await Position.getOpenByOwner(this, owner)
  }

  async positions(owner: string): Promise<Position[]> {
    return await Position.getByOwner(this, owner)
  }

  async trades(owner: string, options?: SortEventOptions): Promise<TradeEvent[]> {
    return await TradeEvent.getByOwner(this, owner, options)
  }

  async collateralUpdates(owner: string, options?: SortEventOptions): Promise<CollateralUpdateEvent[]> {
    return await CollateralUpdateEvent.getByOwner(this, owner, options)
  }

  async position(marketAddressOrName: string, positionId: number): Promise<Position> {
    return await Position.get(this, marketAddressOrName, positionId)
  }

  // Account

  account(address: string): Account {
    return Account.get(this, address)
  }

  async approveStableToken(owner: string, tokenAddress: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await Account.get(this, owner).approveStableToken(tokenAddress, amount)
  }

  async approveBaseToken(owner: string, tokenAddress: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await Account.get(this, owner).approveBaseToken(tokenAddress, amount)
  }

  async approveOptionToken(
    owner: string,
    marketAddressOrName: string,
    isAllowed: boolean
  ): Promise<PopulatedTransaction> {
    const account = await Account.get(this, owner)
    return await account.approveOptionToken(marketAddressOrName, isAllowed)
  }

  async drip(owner: string): Promise<PopulatedTransaction> {
    const account = await Account.get(this, owner)
    return await account.drip()
  }

  // Liquidity Deposits

  async liquidityDeposits(marketAddressOrName: string, owner: string): Promise<LiquidityDeposit[]> {
    return await LiquidityDeposit.getByOwner(this, marketAddressOrName, owner)
  }

  async liquidityDeposit(marketAddressOrName: string, id: string): Promise<LiquidityDeposit> {
    return await LiquidityDeposit.getByQueueId(this, marketAddressOrName, id)
  }

  async deposit(
    beneficiary: string,
    marketAddressOrName: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction | null> {
    return await LiquidityDeposit.deposit(this, marketAddressOrName, beneficiary, amountQuote)
  }

  // Liquidity Withdrawals

  async liquidityWithdrawals(marketAddressOrName: string, owner: string): Promise<LiquidityWithdrawal[]> {
    return await LiquidityWithdrawal.getByOwner(this, marketAddressOrName, owner)
  }

  async liquidityWithdrawal(marketAddressOrName: string, id: string): Promise<LiquidityWithdrawal> {
    return await LiquidityWithdrawal.getByQueueId(this, marketAddressOrName, id)
  }

  async withdraw(
    beneficiary: string,
    marketAddressOrName: string,
    amountLiquidityTokens: BigNumber
  ): Promise<PopulatedTransaction | null> {
    return await LiquidityWithdrawal.withdraw(this, marketAddressOrName, beneficiary, amountLiquidityTokens)
  }

  // Admin
  admin(): Admin {
    return Admin.get(this)
  }

  // Staking
  async staking(): Promise<Staking> {
    return await Staking.get(this)
  }

  // Reward Epoch
  async rewardEpochs(account: string): Promise<RewardEpoch[]> {
    return await RewardEpoch.getByOwner(this, account)
  }
}
