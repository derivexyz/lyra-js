import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'
import { Block } from '@ethersproject/providers'

import { ZERO_BN } from '../constants/bn'
import { DataSource, LyraMarketContractId } from '../constants/contracts'
import { BoardViewStructOutput } from '../constants/views'
import { OptionMarketViewer } from '../contracts/newport/typechain'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike, StrikeQuotes } from '../strike'
import buildTx from '../utils/buildTx'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export type BoardQuotes = {
  strikes: StrikeQuotes[]
  board: Board
}

export class Board {
  private lyra: Lyra
  private __market: Market
  private liveStrikeMap: Record<number, OptionMarketViewer.StrikeViewStructOutput>
  __source = DataSource.ContractCall
  __boardData: BoardViewStructOutput
  block: Block
  id: number
  expiryTimestamp: number
  tradingCutoffTimestamp: number
  isExpired: boolean
  isTradingCutoff: boolean
  timeToExpiry: number
  timeToTradingCutoff: number
  spotPriceAtExpiry?: BigNumber
  baseIv: BigNumber
  isPaused: boolean

  constructor(lyra: Lyra, market: Market, boardView: BoardViewStructOutput, block: Block) {
    this.lyra = lyra
    this.block = block
    this.__market = market
    this.__boardData = boardView
    this.block = block

    const fields = Board.getFields(market, boardView, block)
    this.id = fields.id
    this.expiryTimestamp = fields.expiryTimestamp
    this.timeToExpiry = fields.timeToExpiry
    this.isExpired = fields.isExpired
    this.baseIv = fields.baseIv
    this.spotPriceAtExpiry = fields.spotPriceAtExpiry
    this.isPaused = fields.isPaused
    this.tradingCutoffTimestamp = fields.tradingCutoffTimestamp
    this.timeToTradingCutoff = fields.timeToTradingCutoff
    this.isTradingCutoff = fields.isTradingCutoff
    this.liveStrikeMap = boardView.strikes.reduce(
      (map, strikeView) => ({
        ...map,
        [strikeView.strikeId.toNumber()]: strikeView,
      }),
      {}
    )
  }

  // TODO: @dappbeast Remove getFields
  private static getFields(market: Market, boardView: BoardViewStructOutput, block: Block) {
    const id = boardView.boardId.toNumber()
    const expiryTimestamp = boardView.expiry.toNumber()
    const timeToExpiry = Math.max(0, expiryTimestamp - block.timestamp)
    const tradingCutoffTimestamp =
      expiryTimestamp - market.__marketData.marketParameters.tradeLimitParams.tradingCutoff.toNumber()
    const timeToTradingCutoff = Math.max(0, tradingCutoffTimestamp - block.timestamp)
    const spotPriceAtExpiry = !boardView.priceAtExpiry.isZero() ? boardView.priceAtExpiry : undefined
    // Expired flag is determined by priceAtExpiry state being set
    const isExpired = !!spotPriceAtExpiry && timeToExpiry === 0
    const isTradingCutoff = timeToTradingCutoff === 0
    const baseIv = !isExpired ? boardView.baseIv : ZERO_BN
    const isPaused = boardView.isPaused
    return {
      id,
      expiryTimestamp,
      tradingCutoffTimestamp,
      timeToExpiry,
      timeToTradingCutoff,
      isExpired,
      isTradingCutoff,
      spotPriceAtExpiry,
      baseIv,
      isPaused,
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, boardId: number): Promise<Board> {
    const market = await Market.get(lyra, marketAddressOrName)
    return await market.board(boardId)
  }

  async refresh(): Promise<Board> {
    return await Board.get(this.lyra, this.market().address, this.id)
  }

  // Edges

  market(): Market {
    return this.__market
  }

  strikes(): Strike[] {
    return this.__boardData.strikes.map(strikeView => {
      return new Strike(this.lyra, this, strikeView.strikeId.toNumber(), this.block)
    })
  }

  strike(strikeId: number): Strike {
    const strikeView = this.liveStrikeMap[strikeId]
    if (!strikeView) {
      throw new Error('Strike does not exist for board')
    }
    return new Strike(this.lyra, this, strikeId, this.block)
  }

  option(strikeId: number, isCall: boolean): Option {
    const strike = this.strike(strikeId)
    return strike.option(isCall)
  }

  async quote(
    strikeId: number,
    isCall: boolean,
    isBuy: boolean,
    size: BigNumber,
    options?: QuoteOptions
  ): Promise<Quote> {
    const board = await this.refresh()
    return board.quoteSync(strikeId, isCall, isBuy, size, options)
  }

  quoteSync(strikeId: number, isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Quote {
    return this.option(strikeId, isCall).quoteSync(isBuy, size, options)
  }

  async quoteAll(size: BigNumber, options?: QuoteOptions): Promise<BoardQuotes> {
    const board = await this.refresh()
    return board.quoteAllSync(size, options)
  }

  quoteAllSync(size: BigNumber, options?: QuoteOptions): BoardQuotes {
    return {
      strikes: this.strikes().map(strike => strike.quoteAllSync(size, options)),
      board: this,
    }
  }

  // Admin
  setStrikeSkew(account: string, strikeId: BigNumber, skew: BigNumber): PopulatedTransaction {
    const optionMarket = getLyraMarketContract(
      this.lyra,
      this.__market.__marketData.marketAddresses,
      LyraMarketContractId.OptionMarket
    )
    const calldata = optionMarket.interface.encodeFunctionData('setStrikeSkew', [strikeId, skew])
    const tx = buildTx(this.lyra, optionMarket.address, account, calldata)
    return {
      ...tx,
      gasLimit: BigNumber.from(10_000_000),
    }
  }
}
