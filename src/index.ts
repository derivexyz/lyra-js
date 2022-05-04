import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import { GraphQLClient } from 'graphql-request'

import Account from './account'
import Board from './board'
import CollateralUpdateEvent from './collateral_update_event'
import { Deployment } from './constants/contracts'
import Market, { MarketTradeOptions } from './market'
import Option from './option'
import Position from './position'
import LyraJsonRpcProvider from './provider'
import Quote, { QuoteOptions } from './quote'
import getQuoteBoard from './quote/getQuoteBoard'
import Strike from './strike'
import Trade from './trade'
import TradeEvent, { TradeEventListener, TradeEventListenerCallback, TradeEventListenerOptions } from './trade_event'
import getLyraDeploymentForChainId from './utils/getLyraDeploymentForChainId'

export * from './account'
export * from './board'
export * from './collateral_update_event'
export * from './market'
export * from './option'
export * from './position'
export * from './quote'
export * from './strike'
export * from './trade'
export * from './trade_event'

type LyraConfig = {
  rpcUrl: string
  chainId: number
}

export default class Lyra {
  provider: JsonRpcProvider
  deployment: Deployment
  subgraphClient: GraphQLClient
  blockSubgraphClient: GraphQLClient

  constructor(config?: LyraConfig, disableCache?: boolean) {
    const chainId = config?.chainId ?? 69 // Kovan
    const rpcUrl = config?.rpcUrl ?? 'https://optimism.kovan.io' // Kovan
    const deployment = getLyraDeploymentForChainId(chainId)

    this.provider =
      deployment === Deployment.Local || disableCache
        ? new StaticJsonRpcProvider({ url: rpcUrl, throttleLimit: 1 }, chainId)
        : new LyraJsonRpcProvider({ url: rpcUrl, throttleLimit: 1 }, chainId)
    this.deployment = deployment

    // TOOD: @earthtojake Configurable subgraph URIs
    const subgraphUri = 'https://api.thegraph.com/subgraphs/name/paulvaden/lyra-kovan-2'
    const blockSubgraphUri = 'https://api.thegraph.com/subgraphs/name/paulvaden/blocks-subgraph'

    this.subgraphClient = new GraphQLClient(subgraphUri)
    this.blockSubgraphClient = new GraphQLClient(blockSubgraphUri)

    console.debug('Lyra', {
      rpcUrl,
      deployment,
      subgraphUri,
      blockSubgraphUri,
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

  async trades(owner: string): Promise<TradeEvent[]> {
    return await TradeEvent.getByOwner(this, owner)
  }

  async collateralUpdates(owner: string): Promise<CollateralUpdateEvent[]> {
    return await CollateralUpdateEvent.getByOwner(this, owner)
  }

  async position(marketAddressOrName: string, positionId: number): Promise<Position> {
    return await Position.get(this, marketAddressOrName, positionId)
  }

  // Account

  account(address: string): Account {
    return Account.get(this, address)
  }

  async approveStableToken(
    owner: string,
    tokenAddress: string,
    amount: BigNumber
  ): Promise<ethers.PopulatedTransaction> {
    return await Account.get(this, owner).approveStableToken(tokenAddress, amount)
  }

  async approveBaseToken(owner: string, tokenAddress: string, amount: BigNumber): Promise<ethers.PopulatedTransaction> {
    return await Account.get(this, owner).approveBaseToken(tokenAddress, amount)
  }

  async approveOptionToken(
    owner: string,
    marketAddressOrName: string,
    isAllowed: boolean
  ): Promise<ethers.PopulatedTransaction> {
    const account = await Account.get(this, owner)
    return await account.approveOptionToken(marketAddressOrName, isAllowed)
  }

  async drip(owner: string): Promise<ethers.PopulatedTransaction> {
    const account = await Account.get(this, owner)
    return await account.drip()
  }
}
