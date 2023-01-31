import { BigNumber } from '@ethersproject/bignumber'
import { Block } from '@ethersproject/providers'

import { ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { BoardViewStructOutput, StrikeViewStructOutput } from '../constants/views'
import { OptionMarketViewer as AvalonOptionMarketViewer } from '../contracts/avalon/typechain/AvalonOptionMarketViewer'
import { OptionMarketViewer as NewportOptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'
import Lyra, { Version } from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike, StrikeQuotes } from '../strike'

export type BoardQuotes = {
  strikes: StrikeQuotes[]
  board: Board
}

export type BoardParams = {
  varianceGwavIv: BigNumber
  forceCloseGwavIv: BigNumber
  isBoardPaused: boolean
}

export class Board {
  private __market: Market
  private liveStrikeMap: Record<number, StrikeViewStructOutput>
  __source = DataSource.ContractCall
  lyra: Lyra
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
  params: BoardParams

  constructor(lyra: Lyra, market: Market, boardView: BoardViewStructOutput, block: Block) {
    this.lyra = lyra
    this.block = block
    this.__market = market
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
    this.params = fields.params
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
    const tradingCutoffTimestamp = expiryTimestamp - market.params.tradingCutoff
    const timeToTradingCutoff = Math.max(0, tradingCutoffTimestamp - block.timestamp)
    const spotPriceAtExpiry = !boardView.priceAtExpiry.isZero() ? boardView.priceAtExpiry : undefined
    // Expired flag is determined by priceAtExpiry state being set
    const isExpired = !!spotPriceAtExpiry && timeToExpiry === 0
    const isTradingCutoff = timeToTradingCutoff === 0
    const baseIv = !isExpired ? boardView.baseIv : ZERO_BN
    const isPaused = boardView.isPaused ?? market.isPaused

    let varianceGwavIv: BigNumber
    let forceCloseGwavIv: BigNumber
    if (market.lyra.version === Version.Avalon) {
      const avalonBoardView = boardView as AvalonOptionMarketViewer.BoardViewStructOutput
      // HACK: use forceCloseGwavIV as varianceGwavIv
      varianceGwavIv = avalonBoardView.forceCloseGwavIV
      forceCloseGwavIv = avalonBoardView.forceCloseGwavIV
    } else {
      const newportBoardView = boardView as NewportOptionMarketViewer.BoardViewStructOutput
      varianceGwavIv = newportBoardView.varianceGwavIv
      forceCloseGwavIv = newportBoardView.forceCloseGwavIv
    }

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
      params: {
        varianceGwavIv,
        forceCloseGwavIv,
        isBoardPaused: boardView.isPaused,
      },
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
    return Object.values(this.liveStrikeMap).map(strikeView => {
      return new Strike(this.lyra, this, strikeView, this.block)
    })
  }

  strike(strikeId: number): Strike {
    const strikeView = this.liveStrikeMap[strikeId]
    if (!strikeView) {
      throw new Error('Strike does not exist for board')
    }
    return new Strike(this.lyra, this, strikeView, this.block)
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
}
