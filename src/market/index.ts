import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Block } from '@ethersproject/providers'
import { parseBytes32String } from '@ethersproject/strings'

import { Board } from '../board'
import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource, LyraMarketContractId } from '../constants/contracts'
import { SnapshotOptions } from '../constants/snapshots'
import { OptionGreekCache, OptionMarketPricer, OptionMarketViewer, OptionToken } from '../contracts/typechain'
import { PoolHedger } from '../contracts/typechain/ShortPoolHedger'
import { LiquidityDeposit } from '../liquidity_deposit'
import { LiquidityWithdrawal } from '../liquidity_withdrawal'
import Lyra from '../lyra'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import buildTx from '../utils/buildTx'
import fetchLiquidityHistory from '../utils/fetchLiquidityHistory'
import fetchNetGreeksHistory from '../utils/fetchNetGreeksHistory'
import fetchSpotPriceHistory from '../utils/fetchSpotPriceHistory'
import fetchTradingVolumeHistory from '../utils/fetchTradingVolumeHistory'
import fromBigNumber from '../utils/fromBigNumber'
import getBoardView from '../utils/getBoardView'
import getBoardViewForStrikeId from '../utils/getBoardViewForStrikeId'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getMarketOwner from '../utils/getMaketOwner'
import getMarketAddresses from '../utils/getMarketAddresses'
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
  // HACK @michaelxuwu: needs to be updated once `ShortPoolHedger` is exposed in viewer
  shortPoolHedger?: string
}

export type MarketLiquidity = {
  freeLiquidity: BigNumber
  burnableLiquidity: BigNumber
  totalQueuedDeposits: BigNumber
  nav: BigNumber
  utilization: number
  totalWithdrawingDeposits: BigNumber
  usedCollatLiquidity: BigNumber
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

export type MarketPoolHedger = {
  timestamp: number
  currentNetDelta: string
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

export type GreekCacheParams = {
  [prop in keyof OptionGreekCache.GreekCacheParametersStruct]: BigNumber
}

export type SetMarketParamsReturn<T> = {
  params: T
  tx: PopulatedTransaction
}

export type ForceCloseParams = {
  [prop in keyof OptionGreekCache.ForceCloseParametersStruct]: BigNumber
}

export type MinCollateralParams = {
  [prop in keyof OptionGreekCache.MinCollateralParametersStruct]: BigNumber
}

export type OptionMarketParams = {
  maxBoardExpiry: BigNumber
  securityModule: string
  feePortionReserved: BigNumber
  staticBaseSettlementFee: BigNumber
}

export type LpParams = {
  minDepositWithdraw: BigNumber
  depositDelay: BigNumber
  withdrawalDelay: BigNumber
  withdrawalFee: BigNumber
  liquidityCBThreshold: BigNumber
  liquidityCBTimeout: BigNumber
  ivVarianceCBThreshold: BigNumber
  skewVarianceCBThreshold: BigNumber
  ivVarianceCBTimeout: BigNumber
  skewVarianceCBTimeout: BigNumber
  guardianMultisig: string
  guardianDelay: BigNumber
  boardSettlementCBTimeout: BigNumber
  maxFeePaid: BigNumber
}

export type PricingParams = {
  [prop in keyof OptionMarketPricer.PricingParametersStruct]: BigNumber
}

export type TradeLimitParams = {
  minDelta: BigNumber
  minForceCloseDelta: BigNumber
  tradingCutoff: BigNumber
  minBaseIV: BigNumber
  maxBaseIV: BigNumber
  minSkew: BigNumber
  maxSkew: BigNumber
  minVol: BigNumber
  maxVol: BigNumber
  absMinSkew: BigNumber
  absMaxSkew: BigNumber
  capSkewsToAbs: boolean
}

export type VarianceFeeParams = {
  [prop in keyof OptionMarketPricer.VarianceFeeParametersStruct]: BigNumber
}

export type PartialCollatParams = {
  [prop in keyof OptionToken.PartialCollateralParametersStruct]: BigNumber
}

export type PoolHedgerParams = {
  [prop in keyof PoolHedger.PoolHedgerParametersStruct]: BigNumber
}

export type BoardParams = {
  expiry: BigNumber
  baseIV: BigNumber
  strikePrices: BigNumber[]
  skews: BigNumber[]
  frozen: boolean
}

export type AddBoardReturn = {
  tx: PopulatedTransaction
  board: BoardParams
}

export type StrikeParams = {
  boardId: BigNumber
  strikePrice: BigNumber
  skew: BigNumber
}

export type AddStrikeReturn = {
  tx: PopulatedTransaction
  strike: StrikeParams
}

export type MarketTradeOptions = Omit<TradeOptions, 'minOrMaxPremium' | 'premiumSlippage'>

export type GlobalCache = {
  minUpdatedAt: BigNumber
  minUpdatedAtPrice: BigNumber
  maxUpdatedAtPrice: BigNumber
  maxSkewVariance: BigNumber
  maxIvVariance: BigNumber
  netGreeks: OptionGreekCache.NetGreeksStruct
  isGlobalCacheStale: boolean
}

export class Market {
  private lyra: Lyra
  private liveBoardsMap: Record<number, OptionMarketViewer.BoardViewStructOutput>
  __source = DataSource.ContractCall
  __marketData: OptionMarketViewer.MarketViewWithBoardsStructOutput
  __wrapperMarketId: number | null
  block: Block
  address: string
  name: string
  quoteToken: MarketToken
  baseToken: MarketToken
  tradingCutoff: number
  tvl: BigNumber
  liquidity: MarketLiquidity
  isPaused: boolean
  openInterest: BigNumber
  spotPrice: BigNumber
  depositDelay: number
  withdrawalDelay: number
  contractAddresses: MarketContractAddresses
  marketParameters: OptionMarketViewer.MarketParametersStructOutput

  constructor(
    lyra: Lyra,
    marketView: OptionMarketViewer.MarketViewWithBoardsStructOutput,
    wrapperMarketId: number | null,
    block: Block
  ) {
    this.lyra = lyra
    this.block = block
    this.__marketData = marketView
    this.__wrapperMarketId = wrapperMarketId
    this.marketParameters = marketView.marketParameters

    const fields = Market.getFields(marketView, block)
    this.address = fields.address

    this.isPaused = fields.isPaused
    this.spotPrice = fields.spotPrice
    this.quoteToken = fields.quoteToken
    this.baseToken = fields.baseToken
    this.tradingCutoff = fields.tradingCutoff
    this.name = fields.name
    this.contractAddresses = fields.contractAddresses
    this.tvl = fields.tvl
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
    this.liquidity = fields.liquidity
    this.liveBoardsMap = marketView.liveBoards.reduce(
      (map, boardView) => ({
        ...map,
        [boardView.boardId.toNumber()]: boardView,
      }),
      {}
    )
  }

  // TODO: @dappbeast Remove getFields
  private static getFields(marketView: OptionMarketViewer.MarketViewWithBoardsStructOutput, block: Block) {
    const address = marketView.marketAddresses.optionMarket
    const isPaused = marketView.isPaused
    const spotPrice = marketView.exchangeParams.spotPrice
    const quoteKey = parseBytes32String(marketView.exchangeParams.quoteKey)
    const baseKey = parseBytes32String(marketView.exchangeParams.baseKey)
    const quoteAddress = marketView.marketAddresses.quoteAsset
    const baseAddress = marketView.marketAddresses.baseAsset
    const name = baseKey.substring(1) // Remove leading 's'
    const tvl = marketView.liquidity.NAV
    const tradingCutoff = marketView.marketParameters.tradeLimitParams.tradingCutoff.toNumber()
    const netDelta = marketView.globalNetGreeks.netDelta
    const netStdVega = marketView.globalNetGreeks.netStdVega
    const depositDelay = marketView.marketParameters.lpParams.depositDelay.toNumber()
    const withdrawalDelay = marketView.marketParameters.lpParams.withdrawalDelay.toNumber()
    const freeLiquidity = marketView.liquidity.freeLiquidity
    const burnableLiquidity = marketView.liquidity.burnableLiquidity
    const totalQueuedDeposits = marketView.totalQueuedDeposits
    const nav = marketView.liquidity.NAV
    const utilization = marketView.liquidity.NAV.gt(0)
      ? fromBigNumber(
          marketView.liquidity.NAV.sub(marketView.liquidity.freeLiquidity).mul(UNIT).div(marketView.liquidity.NAV)
        )
      : 0
    const totalWithdrawingDeposits = marketView.totalQueuedWithdrawals
    const usedCollatLiquidity = marketView.liquidity.usedCollatLiquidity
    const pendingDeltaLiquidity = marketView.liquidity.pendingDeltaLiquidity
    const usedDeltaLiquidity = marketView.liquidity.usedDeltaLiquidity
    const tokenPrice = marketView.tokenPrice
    const timestamp = block.timestamp
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
      // TODO: Make liquidity async to acquire accurate hedged NAV
      liquidity: {
        freeLiquidity,
        burnableLiquidity,
        totalQueuedDeposits,
        nav,
        utilization,
        totalWithdrawingDeposits,
        usedCollatLiquidity,
        pendingDeltaLiquidity,
        usedDeltaLiquidity,
        tokenPrice,
        timestamp,
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
    // TODO: @dappbeast Make async
    const strike = this.liveStrike(strikeId)
    const option = strike.option(isCall)
    return Quote.get(option, isBuy, size, options)
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

  // TODO: @dappbeast Add pool + hedger net delta to viewer, make sync
  async netGreeks(): Promise<MarketNetGreeks> {
    const poolHedger = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.ShortPoolHedger)
    const liquidityPool = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.LiquidityPool)
    const [hedgerNetDelta, lockedCollateral] = await Promise.all([
      poolHedger.getCurrentHedgedNetDelta(),
      liquidityPool.lockedCollateral(),
    ])
    const baseBalance = lockedCollateral.base
    const netStdVega = this.__marketData.globalNetGreeks.netStdVega
    const poolNetStdVega = netStdVega.mul(-1)
    const optionsNetDelta = this.__marketData.globalNetGreeks.netDelta.mul(-1)
    const poolNetDelta = optionsNetDelta.add(baseBalance)
    const netDelta = poolNetDelta.add(hedgerNetDelta)
    return {
      netDelta,
      poolNetDelta,
      hedgerNetDelta,
      netStdVega: poolNetStdVega,
      timestamp: this.block.timestamp,
    }
  }

  async liquidityHistory(options?: SnapshotOptions): Promise<MarketLiquidityHistory[]> {
    const liquidityHistory = await fetchLiquidityHistory(this.lyra, this, options)
    const res = mergeAndSortSnapshots(liquidityHistory, 'timestamp')
    return res
  }

  async netGreeksHistory(options?: SnapshotOptions): Promise<MarketNetGreeks[]> {
    const [netGreeks, netGreeksHistory] = await Promise.all([
      this.netGreeks(),
      fetchNetGreeksHistory(this.lyra, this, options),
    ])
    return mergeAndSortSnapshots(netGreeksHistory, 'timestamp', netGreeks)
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

  async getGlobalCache(): Promise<GlobalCache> {
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionGreekCache
    )
    const [isGlobalCacheStale, globalCache] = await Promise.all([
      optionGreekCache.isGlobalCacheStale(this.spotPrice),
      optionGreekCache.getGlobalCache(),
    ])
    return { ...globalCache, isGlobalCacheStale }
  }

  // Transactions

  async deposit(beneficiary: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await LiquidityDeposit.deposit(this.lyra, this.address, beneficiary, amount)
  }

  async withdraw(beneficiary: string, amount: BigNumber): Promise<PopulatedTransaction> {
    return await LiquidityWithdrawal.withdraw(this.lyra, this.address, beneficiary, amount)
  }

  addBoard(
    account: string,
    expiry: BigNumber,
    baseIV: BigNumber,
    strikePrices: BigNumber[],
    skews: BigNumber[],
    frozen: boolean = false
  ): AddBoardReturn {
    const optionMarket = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionMarket)
    const calldata = optionMarket.interface.encodeFunctionData('createOptionBoard', [
      expiry,
      baseIV,
      strikePrices,
      skews,
      frozen,
    ])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { tx, board: { expiry, baseIV, strikePrices, skews, frozen } }
  }

  addStrikeToBoard(account: string, boardId: BigNumber, strike: BigNumber, skew: BigNumber): AddStrikeReturn {
    const optionMarket = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionMarket)
    const calldata = optionMarket.interface.encodeFunctionData('addStrikeToBoard', [boardId, strike, skew])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return {
      tx,
      strike: {
        boardId,
        strikePrice: strike,
        skew,
      },
    }
  }

  setBoardPaused(account: string, boardId: BigNumber, isPaused: boolean): PopulatedTransaction {
    const optionMarket = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionMarket)
    const calldata = optionMarket.interface.encodeFunctionData('setBoardFrozen', [boardId, isPaused])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    return {
      ...tx,
      gasLimit: BigNumber.from(10_000_000),
    }
  }

  setBoardBaseIv(account: string, boardId: BigNumber, baseIv: BigNumber): PopulatedTransaction {
    const optionMarket = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionMarket)
    const calldata = optionMarket.interface.encodeFunctionData('setBoardBaseIv', [boardId, baseIv])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    return {
      ...tx,
      gasLimit: BigNumber.from(10_000_000),
    }
  }

  async setGreekCacheParams(
    account: string,
    greekCacheParams: Partial<GreekCacheParams>
  ): Promise<SetMarketParamsReturn<GreekCacheParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toGreekCacheParams = {
      ...currMarketView.marketParameters.greekCacheParams,
      ...greekCacheParams,
    }
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionGreekCache
    )
    const calldata = optionGreekCache.interface.encodeFunctionData('setGreekCacheParameters', [toGreekCacheParams])
    const tx = buildTx(this.lyra, optionGreekCache.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toGreekCacheParams, tx }
  }

  async setForceCloseParams(
    account: string,
    forceCloseParams: Partial<ForceCloseParams>
  ): Promise<SetMarketParamsReturn<ForceCloseParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toForceCloseParams = {
      ...currMarketView.marketParameters.forceCloseParams,
      ...forceCloseParams,
    }
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionGreekCache
    )
    const calldata = optionGreekCache.interface.encodeFunctionData('setForceCloseParameters', [toForceCloseParams])
    const tx = buildTx(this.lyra, optionGreekCache.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toForceCloseParams, tx }
  }

  async setMinCollateralParams(
    account: string,
    minCollateralParams: Partial<MinCollateralParams>
  ): Promise<SetMarketParamsReturn<MinCollateralParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toMinCollateralParams = {
      ...currMarketView.marketParameters.minCollatParams,
      ...minCollateralParams,
    }
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionGreekCache
    )
    const calldata = optionGreekCache.interface.encodeFunctionData('setMinCollateralParameters', [
      toMinCollateralParams,
    ])
    const tx = buildTx(this.lyra, optionGreekCache.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toMinCollateralParams, tx }
  }

  async setLpParams(account: string, lpParams: Partial<LpParams>): Promise<SetMarketParamsReturn<LpParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toLPParams = {
      ...currMarketView.marketParameters.lpParams,
      ...lpParams,
    }

    const liquidityPool = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.LiquidityPool)
    const calldata = liquidityPool.interface.encodeFunctionData('setLiquidityPoolParameters', [toLPParams])
    const tx = buildTx(this.lyra, liquidityPool.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toLPParams, tx }
  }

  async setPricingParams(
    account: string,
    pricingParams: Partial<PricingParams>
  ): Promise<SetMarketParamsReturn<PricingParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toPricingParams = {
      ...currMarketView.marketParameters.pricingParams,
      ...pricingParams,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionMarketPricer
    )
    const calldata = optionMarketPricer.interface.encodeFunctionData('setPricingParams', [toPricingParams])
    const tx = buildTx(this.lyra, optionMarketPricer.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toPricingParams, tx }
  }

  async setTradeLimitParams(
    account: string,
    tradeLimitParams: Partial<TradeLimitParams>
  ): Promise<SetMarketParamsReturn<TradeLimitParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toTradeLimitParams = {
      ...currMarketView.marketParameters.tradeLimitParams,
      ...tradeLimitParams,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionMarketPricer
    )
    const calldata = optionMarketPricer.interface.encodeFunctionData('setTradeLimitParams', [toTradeLimitParams])
    const tx = buildTx(this.lyra, optionMarketPricer.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toTradeLimitParams, tx }
  }

  async setVarianceFeeParams(
    account: string,
    params: Partial<VarianceFeeParams>
  ): Promise<SetMarketParamsReturn<VarianceFeeParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toParams = {
      ...currMarketView.marketParameters.varianceFeeParams,
      ...params,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.OptionMarketPricer
    )
    const calldata = optionMarketPricer.interface.encodeFunctionData('setVarianceFeeParams', [toParams])
    const tx = buildTx(this.lyra, optionMarketPricer.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async setPartialCollatParams(
    account: string,
    params: Partial<PartialCollatParams>
  ): Promise<SetMarketParamsReturn<PartialCollatParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toParams = {
      ...currMarketView.marketParameters.partialCollatParams,
      ...params,
    }
    const optionToken = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionToken)
    const calldata = optionToken.interface.encodeFunctionData('setPartialCollateralParams', [toParams])
    const tx = buildTx(this.lyra, optionToken.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async setPoolHedgerParams(
    account: string,
    params: Partial<PoolHedgerParams>
  ): Promise<SetMarketParamsReturn<PoolHedgerParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toParams = {
      ...currMarketView.marketParameters.poolHedgerParams,
      ...params,
    }
    const poolHedger = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.ShortPoolHedger)
    const calldata = poolHedger.interface.encodeFunctionData('setPoolHedgerParams', [toParams])
    const tx = buildTx(this.lyra, poolHedger.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async getShortBuffer(): Promise<BigNumber> {
    const shortPoolHedger = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.ShortPoolHedger
    )
    return await shortPoolHedger.shortBuffer()
  }

  async setShortBuffer(
    account: string,
    shortBuffer: BigNumber
  ): Promise<SetMarketParamsReturn<{ shortBuffer: BigNumber }>> {
    const shortPoolHedger = getLyraMarketContract(
      this.lyra,
      this.contractAddresses,
      LyraMarketContractId.ShortPoolHedger
    )
    const calldata = shortPoolHedger.interface.encodeFunctionData('setShortBuffer', [shortBuffer])
    const tx = buildTx(this.lyra, shortPoolHedger.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: { shortBuffer }, tx }
  }

  async setOptionMarketParams(
    account: string,
    params: Partial<OptionMarketParams>
  ): Promise<SetMarketParamsReturn<OptionMarketParams>> {
    const currMarketView = await getMarketView(this.lyra, this.address)
    const toParams = {
      ...currMarketView.marketParameters.optionMarketParams,
      ...params,
    }
    const optionMarket = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.OptionMarket)
    const calldata = optionMarket.interface.encodeFunctionData('setOptionMarketParams', [toParams])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  processDepositQueue(account: string, limit: number): PopulatedTransaction {
    const liquidityPool = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.LiquidityPool)
    const calldata = liquidityPool.interface.encodeFunctionData('processDepositQueue', [limit])
    const tx = buildTx(this.lyra, liquidityPool.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return tx
  }

  processWithdrawalQueue(account: string, limit: number): PopulatedTransaction {
    const liquidityPool = getLyraMarketContract(this.lyra, this.contractAddresses, LyraMarketContractId.LiquidityPool)
    const calldata = liquidityPool.interface.encodeFunctionData('processWithdrawalQueue', [limit])
    const tx = buildTx(this.lyra, liquidityPool.address, account, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return tx
  }
}
