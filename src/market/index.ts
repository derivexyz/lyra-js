import { BigNumber } from '@ethersproject/bignumber'
import { Block } from '@ethersproject/providers'
import { ethers } from 'ethers'

import { Board } from '../board'
import { ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import fetchLiquidityHistoryDataByMarket from '../utils/fetchLiquidityHistoryDataByMarket'
import fetchNetDeltaHistoryDataByMarket from '../utils/fetchNetDeltaHistoryDataByMarket'
import fetchTradingVolumeHistoryDataByMarket from '../utils/fetchTradingVolumeHistoryDataByMarket'
import getBoardView from '../utils/getBoardView'
import getBoardViewForStrikeId from '../utils/getBoardViewForStrikeId'
import getMarketAddresses from '../utils/getMarketAddresses'
import getMarketView from '../utils/getMarketView'
import getMarketViews from '../utils/getMarketViews'

export enum LiquidityHistoryPeriodEnum {
  OneHour = 3600,
  OneDay = 86400,
}

export enum NetDeltaHistoryPeriodEnum {
  OneHour = 3600,
  OneDay = 86400,
}

export enum TradingVolumeHistoryPeriodEnum {
  OneHour = 3600,
  OneDay = 86400,
}

export type MarketToken = {
  address: string
  symbol: string
  decimals: number
}

export type MarketContractAddresses = {
  liquidityPool: string
  liquidityTokens: string
  greekCache: string
  optionMarket: string
  optionMarketPricer: string
  optionToken: string
  shortCollateral: string
  poolHedger: string
}

export type MarketLiquidity = {
  freeLiquidity: BigNumber
  burnableLiquidity: BigNumber
  totalQueuedDeposits: BigNumber
  utilization: BigNumber
  totalWithdrawingDeposits: BigNumber
  usedCollatLiquidity: BigNumber
  pendingDeltaLiquidity: BigNumber
  usedDeltaLiquidity: BigNumber
  tokenPrice: BigNumber
  timestamp: number
}

export type MarketNetDelta = {
  netDelta: BigNumber
  timestamp: number
  // TODO: Add whether snapshot included deltaHedging - isDeltaHedge
}

export type MarketTradingVolumeHistory = {
  premiumVolume: BigNumber
  notionalVolume: BigNumber
  totalPremiumVolume: BigNumber
  totalNotionalVolume: BigNumber
  spotPriceFees: BigNumber
  optionPriceFees: BigNumber
  vegaFees: BigNumber
  deltaCutoffFees: BigNumber
  liquidatorFees: BigNumber
  smLiquidationFees: BigNumber
  lpLiquidationFees: BigNumber
  timestamp: number
}

export type MarketTradeOptions = Omit<TradeOptions, 'minOrMaxPremium' | 'premiumSlippage'>

export class Market {
  private lyra: Lyra
  private block: Block
  __source = DataSource.ContractCall
  __marketData: OptionMarketViewer.MarketViewWithBoardsStructOutput
  __blockNumber: number
  address: string
  name: string
  quoteToken: MarketToken
  baseToken: MarketToken
  tradingCutoff: number
  tvl: BigNumber
  liquidity: MarketLiquidity
  netDelta: BigNumber
  isPaused: boolean
  spotPrice: BigNumber
  contractAddresses: MarketContractAddresses

  constructor(lyra: Lyra, marketView: OptionMarketViewer.MarketViewWithBoardsStructOutput, block: Block) {
    this.lyra = lyra
    this.block = block
    this.__marketData = marketView
    this.__blockNumber = block.number

    const fields = Market.getFields(marketView)
    this.address = fields.address
    this.isPaused = fields.isPaused
    this.spotPrice = fields.spotPrice
    this.quoteToken = fields.quoteToken
    this.baseToken = fields.baseToken
    this.tradingCutoff = fields.tradingCutoff
    this.name = fields.name
    this.contractAddresses = fields.contractAddresses
    this.tvl = fields.tvl
    this.liquidity = fields.liquidity
    this.netDelta = fields.netDelta
  }

  // TODO: @earthtojake Remove getFields
  private static getFields(marketView: OptionMarketViewer.MarketViewWithBoardsStructOutput) {
    const address = marketView.marketAddresses.optionMarket
    const isPaused = marketView.isPaused
    const spotPrice = marketView.exchangeParams.spotPrice
    const quoteKey = ethers.utils.parseBytes32String(marketView.exchangeParams.quoteKey)
    const baseKey = ethers.utils.parseBytes32String(marketView.exchangeParams.baseKey)
    const quoteAddress = marketView.marketAddresses.quoteAsset
    const baseAddress = marketView.marketAddresses.baseAsset
    const name = baseKey.substring(1) // Remove leading 's'
    const tvl = marketView.liquidity.NAV
    const tradingCutoff = marketView.marketParameters.tradeLimitParams.tradingCutoff.toNumber()
    const freeLiquidity = marketView.liquidity.freeLiquidity
    const burnableLiquidity = marketView.liquidity.burnableLiquidity
    const totalQueuedDeposits = ZERO_BN // TODO: getting from next contract update
    const utilization = marketView.liquidity.NAV.sub(marketView.liquidity.freeLiquidity).div(marketView.liquidity.NAV)
    const totalWithdrawingDeposits = ZERO_BN // TODO: getting from next contract update
    const usedCollatLiquidity = marketView.liquidity.usedCollatLiquidity
    const pendingDeltaLiquidity = marketView.liquidity.pendingDeltaLiquidity
    const usedDeltaLiquidity = marketView.liquidity.usedDeltaLiquidity
    const tokenPrice = ZERO_BN // TODO: getting from Jake adding in tokenPrice
    const timestamp = Math.round(new Date().getTime() / 1000)
    const netDelta = marketView.globalNetGreeks.netDelta
    return {
      address,
      name,
      isPaused,
      spotPrice,
      tradingCutoff,
      tvl,
      quoteToken: {
        address: quoteAddress,
        symbol: quoteKey,
        decimals: 18,
      },
      baseToken: {
        address: baseAddress,
        symbol: baseKey,
        decimals: 18,
      },
      contractAddresses: marketView.marketAddresses,
      liquidity: {
        freeLiquidity,
        burnableLiquidity,
        totalQueuedDeposits,
        utilization,
        totalWithdrawingDeposits,
        usedCollatLiquidity,
        pendingDeltaLiquidity,
        usedDeltaLiquidity,
        tokenPrice,
        timestamp,
      },
      netDelta,
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string): Promise<Market> {
    const [marketView, block] = await Promise.all([
      getMarketView(lyra, marketAddressOrName),
      lyra.provider.getBlock('latest'),
    ])
    return new Market(lyra, marketView, block)
  }

  static async getMany(lyra: Lyra, marketAddresses: string[]): Promise<Market[]> {
    const [marketViews, block] = await Promise.all([
      getMarketViews(lyra, marketAddresses),
      lyra.provider.getBlock('latest'),
    ])
    return marketViews.map(marketView => {
      return new Market(lyra, marketView, block)
    })
  }

  static async getAll(lyra: Lyra): Promise<Market[]> {
    const marketAddresses = await getMarketAddresses(lyra)
    return await Market.getMany(
      lyra,
      marketAddresses.map(m => m.optionMarket)
    )
  }

  // Edges

  // TODO: @earthtojake Make async
  liveBoards(): Board[] {
    return this.__marketData.liveBoards.map(boardView => {
      return new Board(this.lyra, this, boardView, this.block)
    })
  }

  liveBoard(boardId: number): Board {
    const board = this.liveBoards().find(board => board.id === boardId)
    if (!board) {
      throw new Error('Board is expired or does not exist for market')
    }
    return board
  }

  async board(boardId: number): Promise<Board> {
    try {
      // Attempt to return live board
      return this.liveBoard(boardId)
    } catch (_e) {
      const [boardView, block] = await Promise.all([
        getBoardView(this.lyra, this.address, boardId),
        this.lyra.provider.getBlock('latest'),
      ])
      return new Board(this.lyra, this, boardView, block)
    }
  }

  liveStrike(strikeId: number): Strike {
    const board = this.liveBoards().find(board => board.strikes().find(strike => strike.id === strikeId))
    const strike = board?.strikes().find(strike => strike.id === strikeId)
    if (!strike) {
      throw new Error('Strike is expired or does not exist for market')
    }
    return strike
  }

  async strike(strikeId: number): Promise<Strike> {
    try {
      return this.liveStrike(strikeId)
    } catch (_e) {
      const [boardView, block] = await Promise.all([
        getBoardViewForStrikeId(this.lyra, this.address, strikeId),
        this.lyra.provider.getBlock('latest'),
      ])
      const board = new Board(this.lyra, this, boardView, block)
      return board.strike(strikeId)
    }
  }

  liveOption(strikeId: number, isCall: boolean) {
    const strike = this.liveStrike(strikeId)
    return strike.option(isCall)
  }

  async option(strikeId: number, isCall: boolean): Promise<Option> {
    const strike = await this.strike(strikeId)
    return strike.option(isCall)
  }

  // Quote

  async quote(
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<Quote> {
    // TODO: @earthtojake Make async
    const strike = this.liveStrike(strikeId)
    const option = strike.option(isCall)
    return Quote.get(option, isBuy, size, options)
  }

  // Trade

  async trade(
    owner: string,
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    options?: MarketTradeOptions
  ): Promise<Trade> {
    return await Trade.get(this.lyra, owner, this.address, strikeId, isCall, isBuy, size, {
      premiumSlippage: slippage,
      ...options,
    })
  }

  // Liquidity

  async liquidityHistory({
    startTimestamp = 0,
    period = LiquidityHistoryPeriodEnum.OneHour,
  }: {
    startTimestamp?: number
    period?: number
  }): Promise<MarketLiquidity[]> {
    const liquidityHistory = await fetchLiquidityHistoryDataByMarket(this.lyra, this, startTimestamp, period)
    const latestLiquidity = this.liquidity
    liquidityHistory.liquidity.push(latestLiquidity)
    return liquidityHistory.liquidity
  }

  // Net Delta

  async netDeltaHistory({
    startTimestamp = 0,
    period = NetDeltaHistoryPeriodEnum.OneHour,
  }: {
    startTimestamp?: number
    period?: number
  }): Promise<MarketNetDelta[]> {
    const netDeltaHistory = await fetchNetDeltaHistoryDataByMarket(this.lyra, this, startTimestamp, period)
    const latestNetDelta = {
      netDelta: this.netDelta,
      timestamp: Math.round(new Date().getTime() / 1000),
      // TODO: Add whether snapshot included deltaHedging - isDeltaHedge
    }
    netDeltaHistory.push(latestNetDelta)
    return netDeltaHistory
  }

  // Trading Volume History

  async tradingVolumeHistory({
    startTimestamp = 0,
    period = TradingVolumeHistoryPeriodEnum.OneHour,
  }: {
    startTimestamp?: number
    period?: number
  }): Promise<MarketTradingVolumeHistory[]> {
    return await fetchTradingVolumeHistoryDataByMarket(this.lyra, this, startTimestamp, period)
  }
}
