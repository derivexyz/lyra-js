import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Block } from '@ethersproject/providers'
import { parseBytes32String } from '@ethersproject/strings'

import { Board, BoardQuotes } from '../board'
import { ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { SnapshotOptions } from '../constants/snapshots'
import {
  BoardViewStructOutput,
  MarketParametersStructOutput,
  MarketViewWithBoardsStructOutput,
} from '../constants/views'
import { OptionMarketViewer as OptionMarketViewerAvalon } from '../contracts/avalon/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain'
import { LiquidityDeposit } from '../liquidity_deposit'
import { LiquidityWithdrawal } from '../liquidity_withdrawal'
import Lyra, { Version } from '../lyra'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import fetchLatestLiquidity from '../utils/fetchLatestLiquidity'
import fetchLatestNetGreeks from '../utils/fetchLatestNetGreeks'
import fetchLiquidityHistory from '../utils/fetchLiquidityHistory'
import fetchNetGreeksHistory from '../utils/fetchNetGreeksHistory'
import fetchSpotPriceHistory from '../utils/fetchSpotPriceHistory'
import fetchTradingVolumeHistory from '../utils/fetchTradingVolumeHistory'
import findMarket from '../utils/findMarket'
import getBoardView from '../utils/getBoardView'
import getBoardViewForStrikeId from '../utils/getBoardViewForStrikeId'
import getMarketOwner from '../utils/getMaketOwner'
import getMarketAddresses from '../utils/getMarketAddresses'
import getMarketName from '../utils/getMarketName'
import getMarketView from '../utils/getMarketView'
import getMarketViews from '../utils/getMarketViews'
import getOptionWrapperMarketId from '../utils/getOptionWrapperMarketId'
import getOptionWrapperMarketIds from '../utils/getOptionWrapperMarketIds'
import mergeAndSortSnapshots from '../utils/mergeAndSortSnapshots'

export type MarketToken = {
  address: string
  symbol: string
  decimals: number
}

export type MarketContractAddresses = {
  liquidityPool: string
  liquidityToken: string
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
  nav: BigNumber
  utilization: number
  totalWithdrawingDeposits: BigNumber
  reservedCollatLiquidity: BigNumber
  pendingDeltaLiquidity: BigNumber
  usedDeltaLiquidity: BigNumber
  tokenPrice: BigNumber
}

export type MarketLiquidityHistory = MarketLiquidity & {
  pendingDeposits: BigNumber
  pendingWithdrawals: BigNumber
  timestamp: number
}

export type MarketNetGreeks = {
  poolNetDelta: BigNumber
  hedgerNetDelta: BigNumber
  netDelta: BigNumber
  netStdVega: BigNumber
  timestamp: number
}

export type MarketTradingVolumeHistory = {
  premiumVolume: BigNumber
  notionalVolume: BigNumber
  totalPremiumVolume: BigNumber
  totalNotionalVolume: BigNumber
  spotPriceFees: BigNumber
  optionPriceFees: BigNumber
  vegaFees: BigNumber
  varianceFees: BigNumber
  deltaCutoffFees: BigNumber
  liquidatorFees: BigNumber
  smLiquidationFees: BigNumber
  lpLiquidationFees: BigNumber
  startTimestamp: number
  endTimestamp: number
}

export type MarketPendingLiquidityHistory = {
  pendingDepositAmount: BigNumber
  pendingWithdrawalAmount: BigNumber
  timestamp: number
}

export type MarketSpotPrice = {
  timestamp: number
  spotPrice: BigNumber
  blockNumber: number
}

export type MarketQuotes = {
  boards: BoardQuotes[]
  market: Market
}
export type MarketTradeOptions = Omit<TradeOptions, 'minOrMaxPremium' | 'premiumSlippage'>

export class Market {
  private liveBoardsMap: Record<number, BoardViewStructOutput>
  __source = DataSource.ContractCall
  __marketData: MarketViewWithBoardsStructOutput
  __wrapperMarketId: number | null
  lyra: Lyra
  block: Block
  address: string
  name: string
  quoteToken: MarketToken
  baseToken: MarketToken
  tradingCutoff: number
  isPaused: boolean
  openInterest: BigNumber
  spotPrice: BigNumber
  depositDelay: number
  withdrawalDelay: number
  contractAddresses: MarketContractAddresses
  marketParameters: MarketParametersStructOutput

  constructor(lyra: Lyra, marketView: MarketViewWithBoardsStructOutput, wrapperMarketId: number | null, block: Block) {
    this.lyra = lyra
    this.block = block
    this.__marketData = marketView
    this.__wrapperMarketId = wrapperMarketId
    this.marketParameters = marketView.marketParameters

    const fields = Market.getFields(lyra.version, marketView)
    this.address = fields.address

    this.isPaused = fields.isPaused
    this.spotPrice = fields.spotPrice
    this.quoteToken = fields.quoteToken
    this.baseToken = fields.baseToken
    this.tradingCutoff = fields.tradingCutoff
    this.name = fields.name
    this.contractAddresses = fields.contractAddresses
    this.openInterest = this.liveBoards().reduce((sum, board) => {
      const strikes = board.strikes()
      const longCallOpenInterest = strikes.reduce((sum, strike) => sum.add(strike.call().longOpenInterest), ZERO_BN)
      const shortCallOpenInterest = strikes.reduce((sum, strike) => sum.add(strike.call().shortOpenInterest), ZERO_BN)
      const longPutOpenInterest = strikes.reduce((sum, strike) => sum.add(strike.put().longOpenInterest), ZERO_BN)
      const shortPutOpenInterest = strikes.reduce((sum, strike) => sum.add(strike.put().shortOpenInterest), ZERO_BN)
      return sum.add(longCallOpenInterest).add(shortCallOpenInterest).add(longPutOpenInterest).add(shortPutOpenInterest)
    }, ZERO_BN)
    this.depositDelay = fields.depositDelay
    this.withdrawalDelay = fields.withdrawalDelay
    const liveBoards: Array<BoardViewStructOutput> = marketView.liveBoards
    this.liveBoardsMap = liveBoards.reduce(
      (map, boardView) => ({
        ...map,
        [boardView.boardId.toNumber()]: boardView,
      }),
      {}
    )
  }

  // TODO: @dappbeast Remove getFields
  private static getFields(version: Version, marketView: MarketViewWithBoardsStructOutput) {
    const address = marketView.marketAddresses.optionMarket
    const isPaused = marketView.isPaused
    let spotPrice, quoteSymbol, baseSymbol
    if (version === Version.Avalon) {
      const avalonMarketView = marketView as OptionMarketViewerAvalon.MarketViewWithBoardsStructOutput
      spotPrice = avalonMarketView.exchangeParams.spotPrice
      quoteSymbol = parseBytes32String(avalonMarketView.exchangeParams.quoteKey)
      baseSymbol = parseBytes32String(avalonMarketView.exchangeParams.baseKey)
    } else {
      const newportMarketView = marketView as OptionMarketViewer.MarketViewWithBoardsStructOutput
      spotPrice = newportMarketView.spotPrice
      quoteSymbol = newportMarketView.quoteSymbol
      baseSymbol = newportMarketView.baseSymbol
    }
    const quoteAddress = marketView.marketAddresses.quoteAsset
    const baseAddress = marketView.marketAddresses.baseAsset
    const name = getMarketName(baseSymbol, quoteSymbol)
    const tradingCutoff = marketView.marketParameters.tradeLimitParams.tradingCutoff.toNumber()
    const netDelta = marketView.globalNetGreeks.netDelta
    const netStdVega = marketView.globalNetGreeks.netStdVega
    const depositDelay = marketView.marketParameters.lpParams.depositDelay.toNumber()
    const withdrawalDelay = marketView.marketParameters.lpParams.withdrawalDelay.toNumber()
    return {
      address,
      name,
      isPaused,
      spotPrice,
      tradingCutoff,
      quoteToken: {
        address: quoteAddress,
        symbol: quoteSymbol,
        decimals: 18,
      },
      baseToken: {
        address: baseAddress,
        symbol: baseSymbol,
        decimals: 18,
      },
      contractAddresses: marketView.marketAddresses,
      netDelta,
      netStdVega,
      depositDelay,
      withdrawalDelay,
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string): Promise<Market> {
    const [marketView, block] = await Promise.all([
      getMarketView(lyra, marketAddressOrName),
      lyra.provider.getBlock('latest'),
    ])
    const marketId = await getOptionWrapperMarketId(lyra, marketView.marketAddresses.optionMarket)
    if (!marketId) {
      console.warn(`No market ID found for ${marketAddressOrName}`)
    }
    return new Market(lyra, marketView, marketId, block)
  }

  static async getMany(lyra: Lyra, marketAddresses: string[]): Promise<Market[]> {
    const [marketViews, marketsToId, block] = await Promise.all([
      getMarketViews(lyra, marketAddresses),
      getOptionWrapperMarketIds(lyra),
      lyra.provider.getBlock('latest'),
    ])
    return marketViews.map(marketView => {
      return new Market(lyra, marketView, marketsToId[marketView.marketAddresses.optionMarket], block)
    })
  }

  static async getAll(lyra: Lyra): Promise<Market[]> {
    const marketAddresses = await getMarketAddresses(lyra)
    return await Market.getMany(
      lyra,
      marketAddresses.map(m => m.optionMarket)
    )
  }

  static find(markets: Market[], marketAddressOrName: string): Market | null {
    if (markets.length === 0) {
      return null
    }
    return findMarket(markets[0].lyra, markets, marketAddressOrName)
  }

  async refresh(): Promise<Market> {
    return await Market.get(this.lyra, this.address)
  }

  // Edges

  // TODO: @dappbeast Make async
  liveBoards(): Board[] {
    return this.__marketData.liveBoards
      .map(boardView => {
        return new Board(this.lyra, this, boardView, this.block)
      })
      .sort((a, b) => a.expiryTimestamp - b.expiryTimestamp)
  }

  liveBoard(boardId: number): Board {
    const boardView = this.liveBoardsMap[boardId]
    if (!boardView) {
      throw new Error('Board is expired or does not exist for market')
    }
    return new Board(this.lyra, this, boardView, this.block)
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

  liveOption(strikeId: number, isCall: boolean): Option {
    const strike = this.liveStrike(strikeId)
    return strike.option(isCall)
  }

  async option(strikeId: number, isCall: boolean): Promise<Option> {
    const strike = await this.strike(strikeId)
    return strike.option(isCall)
  }

  async quote(
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<Quote> {
    const market = await this.refresh()
    return market.quoteSync(strikeId, isCall, isBuy, size, options)
  }

  quoteSync(strikeId: number, isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Quote {
    return this.liveOption(strikeId, isCall).quoteSync(isBuy, size, options)
  }

  async quoteAll(size: BigNumber, options?: QuoteOptions): Promise<MarketQuotes> {
    const market = await this.refresh()
    return market.quoteAllSync(size, options)
  }

  quoteAllSync(size: BigNumber, options?: QuoteOptions): MarketQuotes {
    return {
      boards: this.liveBoards().map(board => board.quoteAllSync(size, options)),
      market: this,
    }
  }

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

  // Dynamic fields
  async liquidity(): Promise<MarketLiquidity> {
    return await fetchLatestLiquidity(this.lyra, this.address)
  }

  async netGreeks(): Promise<MarketNetGreeks> {
    return await fetchLatestNetGreeks(this.lyra, this)
  }

  async liquidityHistory(options?: SnapshotOptions): Promise<MarketLiquidityHistory[]> {
    const liquidityHistory = await fetchLiquidityHistory(this.lyra, this, options)
    const res = mergeAndSortSnapshots(liquidityHistory, 'timestamp')
    return res
  }

  async netGreeksHistory(options?: SnapshotOptions): Promise<MarketNetGreeks[]> {
    const netGreeksHistory = await fetchNetGreeksHistory(this.lyra, this, options)
    return mergeAndSortSnapshots(netGreeksHistory, 'timestamp')
  }

  async tradingVolumeHistory(options?: SnapshotOptions): Promise<MarketTradingVolumeHistory[]> {
    return mergeAndSortSnapshots(await fetchTradingVolumeHistory(this.lyra, this, options), 'endTimestamp')
  }

  async spotPriceHistory(options?: SnapshotOptions): Promise<MarketSpotPrice[]> {
    const spotPriceHistory = await fetchSpotPriceHistory(this.lyra, this.address, options)
    return mergeAndSortSnapshots(spotPriceHistory, 'timestamp', {
      spotPrice: this.spotPrice,
      timestamp: this.block.timestamp,
      blockNumber: this.block.number,
    })
  }

  async owner(): Promise<string> {
    return await getMarketOwner(this.lyra, this.contractAddresses)
  }

  // Transactions

  async deposit(beneficiary: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await LiquidityDeposit.deposit(this.lyra, this.address, beneficiary, amount)
  }

  async withdraw(beneficiary: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await LiquidityWithdrawal.withdraw(this.lyra, this.address, beneficiary, amount)
  }
}
