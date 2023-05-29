import { ApolloClient, HttpLink, InMemoryCache, NormalizedCacheObject } from '@apollo/client/core'
import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { JsonRpcProvider, TransactionReceipt } from '@ethersproject/providers'
import fetch from 'cross-fetch'

import { Account } from './account'
import { AccountRewardEpoch } from './account_reward_epoch'
import { Admin } from './admin'
import { Board, BoardQuotes } from './board'
import { CollateralUpdateEvent } from './collateral_update_event'
import { Chain } from './constants/chain'
import { Deployment } from './constants/contracts'
import { LYRA_API_URL } from './constants/links'
import { Network } from './constants/network'
import { GlobalRewardEpoch } from './global_reward_epoch'
import { LiquidityDeposit } from './liquidity_deposit'
import { LiquidityWithdrawal } from './liquidity_withdrawal'
import { Market, MarketContractAddresses, MarketQuotes, MarketTradeOptions } from './market'
import { Option, OptionQuotes } from './option'
import { Position } from './position'
import { Quote, QuoteOptions } from './quote'
import { SettleEvent } from './settle_event'
import { Strike, StrikeQuotes } from './strike'
import { Trade } from './trade'
import { TradeEvent, TradeEventListener, TradeEventListenerCallback, TradeEventListenerOptions } from './trade_event'
import { TransferEvent } from './transfer_event'
import fetchMarketAddresses from './utils/fetchMarketAddresses'
import fetchPositionEventDataByHash from './utils/fetchPositionEventDataByHash'
import getDefaultVersionForChain from './utils/getDefaultVersionForChain'
import getLyraChainForChainId from './utils/getLyraChainForChainId'
import getLyraChainIdForChain from './utils/getLyraChainIdForChain'
import getLyraDeploymentForChain from './utils/getLyraDeploymentForChain'
import getLyraDeploymentProvider from './utils/getLyraDeploymentProvider'
import getLyraDeploymentSubgraphURI from './utils/getLyraDeploymentSubgraphURI'
import getLyraGovernanceSubgraphURI from './utils/getLyraGovernanceSubgraphURI'
import getNetworkForChain from './utils/getLyraNetworkForChain'

export type LyraConfig = {
  provider: JsonRpcProvider
  subgraphUri?: string
  govSubgraphUri?: string
  apiUri?: string
  version?: Version
}

export enum Version {
  Avalon = 'avalon',
  Newport = 'newport',
}

export { Deployment } from './constants/contracts'

export default class Lyra {
  chain: Chain
  chainId: number
  provider: JsonRpcProvider
  subgraphUri: string
  subgraphClient: ApolloClient<NormalizedCacheObject>
  govSubgraphUri: string
  govSubgraphClient: ApolloClient<NormalizedCacheObject>
  apiUri: string
  deployment: Deployment
  network: Network
  version: Version
  constructor(config: LyraConfig | Chain | number = Chain.Optimism) {
    if (typeof config === 'object') {
      // Config
      const configObj = config as LyraConfig
      this.provider = config.provider
      this.chain = getLyraChainForChainId(this.provider.network.chainId)
      this.apiUri = configObj.apiUri ?? LYRA_API_URL
      this.version = config.version ?? getDefaultVersionForChain(this.chain)
      this.subgraphUri = configObj?.subgraphUri ?? getLyraDeploymentSubgraphURI(this.chain, this.version)
      this.govSubgraphUri = configObj?.govSubgraphUri ?? getLyraGovernanceSubgraphURI(this.chain)
    } else if (typeof config === 'number') {
      // Chain ID
      this.chain = getLyraChainForChainId(config)
      this.provider = getLyraDeploymentProvider(this.chain)
      this.version = getDefaultVersionForChain(this.chain)
      this.subgraphUri = getLyraDeploymentSubgraphURI(this.chain, this.version)
      this.govSubgraphUri = getLyraGovernanceSubgraphURI(this.chain)
    } else {
      // String
      this.chain = config
      this.provider = getLyraDeploymentProvider(this.chain)
      this.version = getDefaultVersionForChain(this.chain)
      this.subgraphUri = getLyraDeploymentSubgraphURI(this.chain, this.version)
      this.govSubgraphUri = getLyraGovernanceSubgraphURI(this.chain)
    }
    this.subgraphClient = new ApolloClient({
      connectToDevTools: true,
      link: new HttpLink({ uri: this.subgraphUri, fetch }),
      cache: new InMemoryCache(),
    })
    this.govSubgraphClient = new ApolloClient({
      connectToDevTools: true,
      link: new HttpLink({ uri: this.govSubgraphUri, fetch }),
      cache: new InMemoryCache(),
    })
    this.network = getNetworkForChain(this.chain)
    this.apiUri = LYRA_API_URL
    this.chainId = getLyraChainIdForChain(this.chain)
    this.deployment = getLyraDeploymentForChain(this.chain)
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

  async quoteOption(
    marketAddressOrName: string,
    strikeId: number,
    isCall: boolean,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<OptionQuotes> {
    const option = await this.option(marketAddressOrName, strikeId, isCall)
    return option.quoteAllSync(size, options)
  }

  async quoteStrike(
    marketAddressOrName: string,
    strikeId: number,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<StrikeQuotes> {
    const strike = await this.strike(marketAddressOrName, strikeId)
    return strike.quoteAllSync(size, options)
  }

  async quoteBoard(
    marketAddressOrName: string,
    boardId: number,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<BoardQuotes> {
    const board = await this.board(marketAddressOrName, boardId)
    return board.quoteAllSync(size, options)
  }

  async quoteMarket(marketAddressOrName: string, size: BigNumber, options?: QuoteOptions): Promise<MarketQuotes> {
    const market = await this.market(marketAddressOrName)
    return market.quoteAllSync(size, options)
  }

  // Trade

  async approveTradeQuote(
    marketAddressOrName: string,
    owner: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction> {
    const market = await this.market(marketAddressOrName)
    return market.approveTradeQuote(owner, amountQuote)
  }

  async approveTradeBase(
    marketAddressOrName: string,
    owner: string,
    amountBase: BigNumber
  ): Promise<PopulatedTransaction> {
    const market = await this.market(marketAddressOrName)
    return market.approveTradeBase(owner, amountBase)
  }

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

  async contractAddresses(): Promise<MarketContractAddresses[]> {
    return await fetchMarketAddresses(this)
  }

  async marketAddresses(): Promise<string[]> {
    return (await this.contractAddresses()).map(({ optionMarket }) => optionMarket)
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

  async position(marketAddressOrName: string, positionId: number): Promise<Position> {
    return await Position.get(this, marketAddressOrName, positionId)
  }

  async events(transactionHashOrReceipt: string | TransactionReceipt): Promise<{
    trades: TradeEvent[]
    collateralUpdates: CollateralUpdateEvent[]
    transfers: TransferEvent[]
    settles: SettleEvent[]
  }> {
    return await fetchPositionEventDataByHash(this, transactionHashOrReceipt)
  }

  // Account

  account(address: string): Account {
    return Account.get(this, address)
  }

  drip(owner: string): PopulatedTransaction {
    const account = Account.get(this, owner)
    return account.drip()
  }

  // Deposits

  async deposits(marketAddressOrName: string, owner: string): Promise<LiquidityDeposit[]> {
    const market = await this.market(marketAddressOrName)
    return await LiquidityDeposit.getByOwner(this, market, owner)
  }

  async approveDeposit(
    marketAddressOrName: string,
    address: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction | null> {
    const market = await this.market(marketAddressOrName)
    return market.approveDeposit(address, amountQuote)
  }

  async initiateDeposit(
    marketAddressOrName: string,
    beneficiary: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction | null> {
    const market = await this.market(marketAddressOrName)
    return market.initiateDeposit(beneficiary, amountQuote)
  }

  // Withdrawals

  async withdrawals(marketAddressOrName: string, owner: string): Promise<LiquidityWithdrawal[]> {
    const market = await this.market(marketAddressOrName)
    return await LiquidityWithdrawal.getByOwner(this, market, owner)
  }

  async initiateWithdraw(
    marketAddressOrName: string,
    beneficiary: string,
    amountLiquidityTokens: BigNumber
  ): Promise<PopulatedTransaction | null> {
    const market = await this.market(marketAddressOrName)
    return market.initiateWithdraw(beneficiary, amountLiquidityTokens)
  }

  // Admin

  admin(): Admin {
    return Admin.get(this)
  }

  // Rewards

  async claimRewards(owner: string, tokenAddresses: string[]) {
    return await AccountRewardEpoch.claim(this, owner, tokenAddresses)
  }

  async globalRewardEpochs(): Promise<GlobalRewardEpoch[]> {
    return await GlobalRewardEpoch.getAll(this)
  }

  async accountRewardEpochs(owner: string): Promise<AccountRewardEpoch[]> {
    return await AccountRewardEpoch.getByOwner(this, owner)
  }
}
