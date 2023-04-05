import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Block } from '@ethersproject/providers'
import { parseBytes32String } from '@ethersproject/strings'

import { PoolHedgerParams } from '../admin'
import { Board, BoardQuotes } from '../board'
import { ZERO_BN } from '../constants/bn'
import { DataSource, LyraMarketContractId } from '../constants/contracts'
import { LyraMarketContractMap } from '../constants/mappings'
import { SnapshotOptions } from '../constants/snapshots'
import { BoardViewStructOutput, MarketViewWithBoardsStructOutput } from '../constants/views'
import { OptionMarketViewer as AvalonOptionMarketViewer } from '../contracts/avalon/typechain/AvalonOptionMarketViewer'
import { GMXAdapter } from '../contracts/newport/typechain/NewportGMXAdapter'
import { GMXFuturesPoolHedger } from '../contracts/newport/typechain/NewportGMXFuturesPoolHedger'
import { OptionMarketViewer as NewportOptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'
import { LiquidityDeposit } from '../liquidity_deposit'
import { LiquidityWithdrawal } from '../liquidity_withdrawal'
import Lyra, { Version } from '../lyra'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import fetchAvalonMarketView from '../utils/fetchAvalonMarketView'
import fetchLatestLiquidity from '../utils/fetchLatestLiquidity'
import fetchLatestNetGreeks from '../utils/fetchLatestNetGreeks'
import fetchLiquidityHistory from '../utils/fetchLiquidityHistory'
import fetchMarketAddresses from '../utils/fetchMarketAddresses'
import fetchMarketOwner from '../utils/fetchMarketOwner'
import fetchNetGreeksHistory from '../utils/fetchNetGreeksHistory'
import fetchNewportMarketViews from '../utils/fetchNewportMarketViews'
import fetchSpotPriceHistory from '../utils/fetchSpotPriceHistory'
import fetchTradingVolumeHistory from '../utils/fetchTradingVolumeHistory'
import findMarket from '../utils/findMarket'
import getBoardView from '../utils/getBoardView'
import getBoardViewForStrikeId from '../utils/getBoardViewForStrikeId'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getMarketName from '../utils/getMarketName'
import isMarketEqual from '../utils/isMarketEqual'

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
  quoteAsset: string
  baseAsset: string
}

export type MarketLiquiditySnapshot = {
  market: Market
  tvl: BigNumber
  freeLiquidity: BigNumber
  burnableLiquidity: BigNumber
  utilization: number
  reservedCollatLiquidity: BigNumber
  pendingDeltaLiquidity: BigNumber
  usedDeltaLiquidity: BigNumber
  tokenPrice: BigNumber
  pendingDeposits: BigNumber
  pendingWithdrawals: BigNumber
  timestamp: number
}

export type MarketNetGreeksSnapshot = {
  poolNetDelta: BigNumber
  hedgerNetDelta: BigNumber
  netDelta: BigNumber
  netStdVega: BigNumber
  timestamp: number
}

export type MarketTradingVolumeSnapshot = {
  premiumVolume: BigNumber
  notionalVolume: BigNumber
  totalShortOpenInterestUSD: BigNumber
  vaultFees: BigNumber
  vaultFeeComponents: {
    spotPriceFees: BigNumber
    optionPriceFees: BigNumber
    vegaUtilFees: BigNumber
    varianceFees: BigNumber
    forceCloseFees: BigNumber
    liquidationFees: BigNumber
  }
  totalPremiumVolume: BigNumber
  totalNotionalVolume: BigNumber
  liquidatorFees: BigNumber
  smLiquidationFees: BigNumber
  startTimestamp: number
  endTimestamp: number
}

export type MarketSpotCandle = {
  period: number
  open: BigNumber
  high: BigNumber
  low: BigNumber
  close: BigNumber
  startTimestamp: number
  startBlockNumber: number
  endTimestamp: number
}

export type PoolHedgerView = GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput
export type ExchangeAdapterView = GMXAdapter.GMXAdapterStateStructOutput

export type MarketQuotes = {
  boards: BoardQuotes[]
  market: Market
}

export type MarketTradeOptions = Omit<TradeOptions, 'minOrMaxPremium' | 'slippage'>

export type MarketParameters = {
  rateAndCarry: BigNumber
  optionPriceFee1xPoint: number
  optionPriceFee2xPoint: number
  optionPriceFeeCoefficient: BigNumber
  spotPriceFee1xPoint: number
  spotPriceFee2xPoint: number
  spotPriceFeeCoefficient: BigNumber
  vegaFeeCoefficient: BigNumber
  minDelta: BigNumber
  shockVolA: BigNumber
  shockVolB: BigNumber
  shockVolPointA: BigNumber
  shockVolPointB: BigNumber
  minStaticQuoteCollateral: BigNumber
  minStaticBaseCollateral: BigNumber
  callSpotPriceShock: BigNumber
  putSpotPriceShock: BigNumber
  standardSize: BigNumber
  skewAdjustmentFactor: BigNumber
  minForceCloseDelta: BigNumber
  shortPostCutoffVolShock: BigNumber
  shortVolShock: BigNumber
  longPostCutoffVolShock: BigNumber
  longVolShock: BigNumber
  shortSpotMin: BigNumber
  absMinSkew: BigNumber
  absMaxSkew: BigNumber
  minSkew: BigNumber
  maxSkew: BigNumber
  maxBaseIv: BigNumber
  maxVol: BigNumber
  minBaseIv: BigNumber
  minVol: BigNumber
  forceCloseVarianceFeeCoefficient: BigNumber
  defaultVarianceFeeCoefficient: BigNumber
  minimumStaticVega: BigNumber
  vegaCoefficient: BigNumber
  referenceSkew: BigNumber
  minimumStaticSkewAdjustment: BigNumber
  skewAdjustmentCoefficient: BigNumber
  minimumStaticIvVariance: BigNumber
  ivVarianceCoefficient: BigNumber
  withdrawalFee: BigNumber
  depositDelay: number
  withdrawalDelay: number
  tradingCutoff: number
  freeLiquidity: BigNumber
  NAV: BigNumber
  tokenPrice: BigNumber
  netStdVega: BigNumber
  netDelta: BigNumber
  hedgerView: PoolHedgerView | null
  adapterView: ExchangeAdapterView | null
  isMarketPaused: boolean
  isGlobalPaused: boolean
  owner: string
  referenceSpotPrice: BigNumber
  poolHedgerParams: PoolHedgerParams | null
}

export class Market {
  private liveBoardsMap: Record<number, BoardViewStructOutput>
  __source = DataSource.ContractCall
  __data: MarketViewWithBoardsStructOutput
  lyra: Lyra
  block: Block
  address: string
  name: string
  quoteToken: MarketToken
  baseToken: MarketToken
  liquidityToken: MarketToken
  isPaused: boolean
  openInterest: BigNumber
  spotPrice: BigNumber
  contractAddresses: MarketContractAddresses
  params: MarketParameters

  constructor(
    lyra: Lyra,
    marketView: MarketViewWithBoardsStructOutput,
    isGlobalPaused: boolean,
    owner: string,
    tokenPrice: BigNumber,
    block: Block,
    // TODO @michaelxuwu remove this when parmas added to viewer
    hedgerView?: PoolHedgerView,
    adapterView?: ExchangeAdapterView,
    poolHedgerParams?: PoolHedgerParams
  ) {
    this.lyra = lyra
    this.block = block
    this.__data = marketView
    const fields = Market.getFields(
      lyra.version,
      marketView,
      isGlobalPaused,
      owner,
      tokenPrice,
      hedgerView,
      adapterView,
      poolHedgerParams
    )
    this.address = fields.address

    this.isPaused = fields.isPaused
    this.spotPrice = fields.spotPrice
    this.quoteToken = fields.quoteToken
    this.baseToken = fields.baseToken
    this.liquidityToken = fields.liquidityToken
    this.name = fields.name
    this.contractAddresses = fields.contractAddresses

    const liveBoards: Array<BoardViewStructOutput> = marketView.liveBoards

    this.openInterest = liveBoards.reduce((sum, board) => {
      const longCallOpenInterest = board.strikes.reduce((sum, strike) => sum.add(strike.longCallOpenInterest), ZERO_BN)
      const shortCallOpenInterest = board.strikes.reduce(
        (sum, strike) => sum.add(strike.shortCallBaseOpenInterest).add(strike.shortCallQuoteOpenInterest),
        ZERO_BN
      )
      const longPutOpenInterest = board.strikes.reduce((sum, strike) => sum.add(strike.longPutOpenInterest), ZERO_BN)
      const shortPutOpenInterest = board.strikes.reduce((sum, strike) => sum.add(strike.shortPutOpenInterest), ZERO_BN)
      return sum.add(longCallOpenInterest).add(shortCallOpenInterest).add(longPutOpenInterest).add(shortPutOpenInterest)
    }, ZERO_BN)

    this.params = fields.params

    this.liveBoardsMap = liveBoards.reduce(
      (map, boardView) => ({
        ...map,
        [boardView.boardId.toNumber()]: boardView,
      }),
      {}
    )
  }

  // TODO: @dappbeast Remove getFields
  private static getFields(
    version: Version,
    marketView: MarketViewWithBoardsStructOutput,
    isGlobalPaused: boolean,
    owner: string,
    tokenPrice: BigNumber,
    hedgerView?: PoolHedgerView,
    adapterView?: ExchangeAdapterView,
    poolHedgerParams?: PoolHedgerParams
  ) {
    const address = marketView.marketAddresses.optionMarket
    const isPaused = marketView.isPaused ?? isGlobalPaused
    let spotPrice, quoteSymbol, baseSymbol, quoteDecimals, baseDecimals
    let params: MarketParameters

    const pricingParams = marketView.marketParameters.pricingParams
    const tradeLimitParams = marketView.marketParameters.tradeLimitParams
    const minCollatParams = marketView.marketParameters.minCollatParams
    const forceCloseParams = marketView.marketParameters.forceCloseParams
    const varianceFeeParams = marketView.marketParameters.varianceFeeParams
    const lpParams = marketView.marketParameters.lpParams
    const sharedParams = {
      optionPriceFee1xPoint: pricingParams.optionPriceFee1xPoint.toNumber(),
      optionPriceFee2xPoint: pricingParams.optionPriceFee2xPoint.toNumber(),
      optionPriceFeeCoefficient: pricingParams.optionPriceFeeCoefficient,
      spotPriceFee1xPoint: pricingParams.spotPriceFee1xPoint.toNumber(),
      spotPriceFee2xPoint: pricingParams.spotPriceFee2xPoint.toNumber(),
      spotPriceFeeCoefficient: pricingParams.spotPriceFeeCoefficient,
      vegaFeeCoefficient: pricingParams.vegaFeeCoefficient,
      minDelta: tradeLimitParams.minDelta,
      shockVolA: minCollatParams.shockVolA,
      shockVolB: minCollatParams.shockVolB,
      shockVolPointA: minCollatParams.shockVolPointA,
      shockVolPointB: minCollatParams.shockVolPointB,
      minStaticQuoteCollateral: minCollatParams.minStaticQuoteCollateral,
      minStaticBaseCollateral: minCollatParams.minStaticBaseCollateral,
      callSpotPriceShock: minCollatParams.callSpotPriceShock,
      putSpotPriceShock: minCollatParams.putSpotPriceShock,
      standardSize: pricingParams.standardSize,
      skewAdjustmentFactor: pricingParams.skewAdjustmentFactor,
      minForceCloseDelta: tradeLimitParams.minForceCloseDelta,
      shortPostCutoffVolShock: forceCloseParams.shortPostCutoffVolShock,
      shortVolShock: forceCloseParams.shortVolShock,
      longPostCutoffVolShock: forceCloseParams.longPostCutoffVolShock,
      longVolShock: forceCloseParams.longVolShock,
      shortSpotMin: forceCloseParams.shortSpotMin,
      absMinSkew: tradeLimitParams.absMinSkew,
      absMaxSkew: tradeLimitParams.absMaxSkew,
      minSkew: tradeLimitParams.minSkew,
      maxSkew: tradeLimitParams.maxSkew,
      maxBaseIv: tradeLimitParams.maxBaseIV,
      maxVol: tradeLimitParams.maxVol,
      minBaseIv: tradeLimitParams.minBaseIV,
      minVol: tradeLimitParams.minVol,
      forceCloseVarianceFeeCoefficient: varianceFeeParams.forceCloseVarianceFeeCoefficient,
      defaultVarianceFeeCoefficient: varianceFeeParams.defaultVarianceFeeCoefficient,
      minimumStaticVega: varianceFeeParams.minimumStaticVega,
      vegaCoefficient: varianceFeeParams.vegaCoefficient,
      referenceSkew: varianceFeeParams.referenceSkew,
      minimumStaticSkewAdjustment: varianceFeeParams.minimumStaticSkewAdjustment,
      skewAdjustmentCoefficient: varianceFeeParams.skewAdjustmentCoefficient,
      minimumStaticIvVariance: varianceFeeParams.minimumStaticIvVariance,
      ivVarianceCoefficient: varianceFeeParams.ivVarianceCoefficient,
      withdrawalFee: lpParams.withdrawalFee,
      withdrawalDelay: lpParams.withdrawalDelay.toNumber(),
      depositDelay: lpParams.depositDelay.toNumber(),
      tradingCutoff: tradeLimitParams.tradingCutoff.toNumber(),
      NAV: marketView.liquidity.NAV,
      freeLiquidity: marketView.liquidity.freeLiquidity,
      tokenPrice,
      netStdVega: marketView.globalNetGreeks.netStdVega,
      netDelta: marketView.globalNetGreeks.netDelta,
      isGlobalPaused,
      isMarketPaused: marketView.isPaused,
      owner,
      poolHedgerParams:
        poolHedgerParams ??
        (marketView as AvalonOptionMarketViewer.MarketViewWithBoardsStructOutput).marketParameters.poolHedgerParams,
      hedgerView: hedgerView ?? null,
      adapterView: adapterView ?? null,
    }

    if (version === Version.Avalon) {
      const avalonMarketView = marketView as AvalonOptionMarketViewer.MarketViewWithBoardsStructOutput
      spotPrice = avalonMarketView.exchangeParams.spotPrice
      quoteSymbol = parseBytes32String(avalonMarketView.exchangeParams.quoteKey)
      baseSymbol = parseBytes32String(avalonMarketView.exchangeParams.baseKey)
      quoteDecimals = 18
      baseDecimals = 18
      params = {
        referenceSpotPrice: spotPrice,
        rateAndCarry: avalonMarketView.marketParameters.greekCacheParams.rateAndCarry,
        ...sharedParams,
      }
    } else {
      if (!adapterView || !hedgerView) {
        throw new Error('Adapter or hedger view does not exist')
      }
      const newportMarketView = marketView as NewportOptionMarketViewer.MarketViewStructOutput
      spotPrice = adapterView.gmxMaxPrice
      quoteSymbol = newportMarketView.quoteSymbol
      quoteDecimals = newportMarketView.quoteDecimals.toNumber()
      baseSymbol = newportMarketView.baseSymbol
      baseDecimals = newportMarketView.baseDecimals.toNumber()
      params = {
        rateAndCarry: adapterView.rateAndCarry,
        referenceSpotPrice: newportMarketView.spotPrice,
        ...sharedParams,
      }
    }
    const quoteAddress = marketView.marketAddresses.quoteAsset
    const baseAddress = marketView.marketAddresses.baseAsset
    const name = getMarketName(baseSymbol, quoteSymbol)
    const tradingCutoff = marketView.marketParameters.tradeLimitParams.tradingCutoff.toNumber()
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
        decimals: quoteDecimals,
      },
      baseToken: {
        address: baseAddress,
        symbol: baseSymbol,
        decimals: baseDecimals,
      },
      liquidityToken: {
        address: marketView.marketAddresses.liquidityToken,
        symbol: `${baseSymbol}LP`,
        decimals: 18,
      },
      contractAddresses: marketView.marketAddresses,
      depositDelay,
      withdrawalDelay,
      params,
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string): Promise<Market> {
    if (lyra.version === Version.Avalon) {
      const [{ marketView, isGlobalPaused, owner }, block] = await Promise.all([
        fetchAvalonMarketView(lyra, marketAddressOrName),
        lyra.provider.getBlock('latest'),
      ])
      return new Market(lyra, marketView, isGlobalPaused, owner, marketView.tokenPrice, block)
    } else {
      const market = (await Market.getAll(lyra)).find(market => market.isEqual(marketAddressOrName))
      if (!market) {
        throw new Error('Market does not exist')
      }
      return market
    }
  }

  static async getMany(lyra: Lyra, marketAddresses: string[]): Promise<Market[]> {
    if (lyra.version === Version.Avalon) {
      const [marketViews, block] = await Promise.all([
        Promise.all(marketAddresses.map(marketAddress => fetchAvalonMarketView(lyra, marketAddress))),
        lyra.provider.getBlock('latest'),
      ])
      return marketViews.map(({ marketView, isGlobalPaused, owner }) => {
        return new Market(lyra, marketView, isGlobalPaused, owner, marketView.tokenPrice, block)
      })
    } else {
      return (await Market.getAll(lyra)).filter(market => marketAddresses.includes(market.address))
    }
  }

  static async getAll(lyra: Lyra): Promise<Market[]> {
    if (lyra.version === Version.Avalon) {
      const marketAddresses = await fetchMarketAddresses(lyra)
      return await Market.getMany(
        lyra,
        marketAddresses.map(m => m.optionMarket)
      )
    } else {
      const [{ marketViews, isGlobalPaused, owner }, block] = await Promise.all([
        fetchNewportMarketViews(lyra),
        lyra.provider.getBlock('latest'),
      ])
      const markets = marketViews.map(
        ({ marketView, hedgerView, adapterView, poolHedgerParams, tokenPrice }) =>
          new Market(
            lyra,
            marketView,
            isGlobalPaused,
            owner,
            tokenPrice,
            block,
            hedgerView,
            adapterView,
            poolHedgerParams
          )
      )
      return markets
    }
  }

  static find(markets: Market[], marketAddressOrName: string): Market | null {
    return findMarket(markets, marketAddressOrName)
  }

  async refresh(): Promise<Market> {
    return await Market.get(this.lyra, this.address)
  }

  // Edges

  isEqual(marketAddressOrName: string): boolean {
    return isMarketEqual(this, marketAddressOrName)
  }

  liveBoards(): Board[] {
    return Object.values(this.liveBoardsMap)
      .map(boardView => {
        return new Board(this.lyra, this, boardView, this.block)
      })
      .filter(b => this.block.timestamp < b.expiryTimestamp)
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

  contract<C extends LyraMarketContractId, V extends Version>(contractId: C): LyraMarketContractMap<V, C> {
    return getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      this.lyra.version,
      contractId
    ) as LyraMarketContractMap<V, C>
  }

  // Transactions

  async trade(
    owner: string,
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    slippage: number,
    options?: MarketTradeOptions
  ): Promise<Trade> {
    return await Trade.get(this.lyra, owner, this.address, strikeId, isCall, isBuy, size, slippage, {
      ...options,
    })
  }

  approveDeposit(owner: string, amountQuote: BigNumber): PopulatedTransaction {
    return LiquidityDeposit.approve(this, owner, amountQuote)
  }

  initiateDeposit(beneficiary: string, amountQuote: BigNumber): PopulatedTransaction {
    return LiquidityDeposit.initiateDeposit(this, beneficiary, amountQuote)
  }

  initiateWithdraw(beneficiary: string, amountLiquidityTokens: BigNumber): PopulatedTransaction {
    return LiquidityWithdrawal.initiateWithdraw(this, beneficiary, amountLiquidityTokens)
  }

  approveTradeQuote(owner: string, amountQuote: BigNumber): PopulatedTransaction {
    return Trade.approveQuote(this, owner, amountQuote)
  }

  approveTradeBase(owner: string, amountBase: BigNumber): PopulatedTransaction {
    return Trade.approveBase(this, owner, amountBase)
  }

  // Dynamic fields

  async liquidity(): Promise<MarketLiquiditySnapshot> {
    return await fetchLatestLiquidity(this.lyra, this)
  }

  async netGreeks(): Promise<MarketNetGreeksSnapshot> {
    return await fetchLatestNetGreeks(this.lyra, this)
  }

  async liquidityHistory(options?: SnapshotOptions): Promise<MarketLiquiditySnapshot[]> {
    return await fetchLiquidityHistory(this.lyra, this, options)
  }

  async netGreeksHistory(options?: SnapshotOptions): Promise<MarketNetGreeksSnapshot[]> {
    return await fetchNetGreeksHistory(this.lyra, this, options)
  }

  async tradingVolumeHistory(options?: SnapshotOptions): Promise<MarketTradingVolumeSnapshot[]> {
    return await fetchTradingVolumeHistory(this.lyra, this, options)
  }

  async spotPriceHistory(options?: SnapshotOptions): Promise<MarketSpotCandle[]> {
    return await fetchSpotPriceHistory(this.lyra, this, options)
  }

  async owner(): Promise<string> {
    return await fetchMarketOwner(this.lyra, this.contractAddresses)
  }
}
