import { BigNumber } from '@ethersproject/bignumber'
import { Block } from '@ethersproject/providers'
import { PopulatedTransaction } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { DataSource, LyraMarketContractId } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import buildTx from '../utils/buildTx'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export class Board {
  // TODO: Use variables
  lyra: Lyra
  block: Block
  private __market: Market
  __source = DataSource.ContractCall
  __boardData: OptionMarketViewer.BoardViewStructOutput
  __blockNumber: number
  __blockTimestamp: number
  id: number
  expiryTimestamp: number
  isExpired: boolean
  timeToExpiry: number
  priceAtExpiry?: BigNumber
  baseIv: BigNumber
  isPaused: boolean

  constructor(lyra: Lyra, market: Market, boardView: OptionMarketViewer.BoardViewStructOutput, block: Block) {
    this.lyra = lyra
    this.block = block
    this.__market = market
    this.__boardData = boardView
    this.__blockNumber = block.number
    this.__blockTimestamp = block.timestamp

    const fields = Board.getFields(boardView, block)
    this.id = fields.id
    this.expiryTimestamp = fields.expiryTimestamp
    this.timeToExpiry = fields.timeToExpiry
    this.isExpired = fields.isExpired
    this.baseIv = fields.baseIv
    this.priceAtExpiry = fields.priceAtExpiry
    this.isPaused = fields.isPaused
  }

  // TODO: @earthtojake Remove getFields
  private static getFields(boardView: OptionMarketViewer.BoardViewStructOutput, block: Block) {
    const id = boardView.boardId.toNumber()
    const expiryTimestamp = boardView.expiry.toNumber()
    const timeToExpiry = Math.max(0, expiryTimestamp - block.timestamp)
    const priceAtExpiry = !boardView.priceAtExpiry.isZero() ? boardView.priceAtExpiry : undefined
    // Expired flag is determined by priceAtExpiry state being set
    const isExpired = !!priceAtExpiry
    const baseIv = !isExpired ? boardView.baseIv : ZERO_BN
    const isPaused = boardView.isPaused
    return {
      id,
      expiryTimestamp,
      timeToExpiry,
      isExpired,
      priceAtExpiry,
      baseIv,
      isPaused,
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, boardId: number): Promise<Board> {
    const market = await Market.get(lyra, marketAddressOrName)
    return await market.board(boardId)
  }

  // Edges

  market(): Market {
    return this.__market
  }

  strikes(): Strike[] {
    return this.__boardData.strikes.map(strikeView => {
      return new Strike(this, strikeView.strikeId.toNumber())
    })
  }

  strike(strikeId: number): Strike {
    const strike = this.strikes().find(strike => strike.id === strikeId)
    if (!strike) {
      throw new Error('Strike does not exist for board')
    }
    return strike
  }

  option(strikeId: number, isCall: boolean): Option {
    const strike = this.strike(strikeId)
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
    return await this.market().quote(strikeId, isCall, isBuy, size, options)
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
