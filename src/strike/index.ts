import { BigNumber } from '@ethersproject/bignumber'
import { Block } from '@ethersproject/providers'

import { Board } from '../board'
import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { SnapshotOptions } from '../constants/snapshots'
import { StrikeViewStructOutput } from '../constants/views'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Quote, QuoteOptions } from '../quote'
import { getDelta, getGamma, getVega } from '../utils/blackScholes'
import fetchStrikeIVHistory from '../utils/fetchStrikeIVHistory'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'

export type StrikeHistoryOptions = {
  startTimestamp?: number
}

export type StrikeIVHistory = {
  iv: number
  timestamp: number
}

export type StrikeQuotes = {
  callBid: Quote
  callAsk: Quote
  putBid: Quote
  putAsk: Quote
  strike: Strike
}

export type StrikeParams = {
  forceCloseSkew: BigNumber
  cachedStdVega: BigNumber
}

export class Strike {
  private __board: Board
  __source = DataSource.ContractCall
  lyra: Lyra
  block: Block
  id: number
  strikePrice: BigNumber
  skew: BigNumber
  iv: BigNumber
  vega: BigNumber
  gamma: BigNumber
  isDeltaInRange: boolean
  openInterest: BigNumber
  longCallOpenInterest: BigNumber
  shortCallOpenInterest: BigNumber
  longPutOpenInterest: BigNumber
  shortPutOpenInterest: BigNumber
  params: StrikeParams

  constructor(lyra: Lyra, board: Board, strikeView: StrikeViewStructOutput, block: Block) {
    this.lyra = lyra
    this.__board = board
    const fields = Strike.getFields(board, strikeView)
    this.block = block
    this.id = fields.id
    this.strikePrice = fields.strikePrice
    this.skew = fields.skew
    this.iv = fields.iv
    this.vega = fields.vega
    this.gamma = fields.gamma
    this.isDeltaInRange = fields.isDeltaInRange
    this.openInterest = fields.openInterest
    this.longCallOpenInterest = fields.longCallOpenInterest
    this.shortCallOpenInterest = fields.shortCallOpenInterest
    this.longPutOpenInterest = fields.longPutOpenInterest
    this.shortPutOpenInterest = fields.shortPutOpenInterest
    this.params = fields.params
  }

  private static getFields(board: Board, strikeView: StrikeViewStructOutput) {
    const id = strikeView.strikeId.toNumber()
    const strikePrice = strikeView.strikePrice
    const timeToExpiryAnnualized = getTimeToExpiryAnnualized(board)
    const skew = strikeView.skew
    const iv = board.baseIv.mul(strikeView.skew).div(UNIT)
    const params = {
      forceCloseSkew: strikeView.forceCloseSkew,
      cachedStdVega: strikeView.cachedGreeks.stdVega,
    }
    if (timeToExpiryAnnualized === 0) {
      return {
        id,
        strikePrice,
        skew: ZERO_BN,
        iv: ZERO_BN,
        vega: ZERO_BN,
        gamma: ZERO_BN,
        openInterest: ZERO_BN,
        longCallOpenInterest: ZERO_BN,
        shortCallOpenInterest: ZERO_BN,
        longPutOpenInterest: ZERO_BN,
        shortPutOpenInterest: ZERO_BN,
        isDeltaInRange: false,
        params,
      }
    } else {
      const ivNum = fromBigNumber(iv)
      const spotPrice = fromBigNumber(board.market().spotPrice)
      const strikePriceNum = fromBigNumber(strikePrice)
      const rate = fromBigNumber(board.market().params.rateAndCarry)
      const vega =
        ivNum > 0 && spotPrice > 0
          ? toBigNumber(getVega(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate))
          : ZERO_BN
      const gamma =
        ivNum > 0 && spotPrice > 0
          ? toBigNumber(getGamma(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate))
          : ZERO_BN
      const callDelta =
        ivNum > 0 && spotPrice > 0
          ? toBigNumber(getDelta(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate, true))
          : ZERO_BN
      const minDelta = board.market().params.minDelta
      const isDeltaInRange = callDelta.gte(minDelta) && callDelta.lte(ONE_BN.sub(minDelta))

      const longCallOpenInterest = strikeView.longCallOpenInterest
      const shortCallOpenInterest = strikeView.shortCallBaseOpenInterest.add(strikeView.shortCallQuoteOpenInterest)
      const longPutOpenInterest = strikeView.longPutOpenInterest
      const shortPutOpenInterest = strikeView.shortPutOpenInterest
      const openInterest = longCallOpenInterest
        .add(shortCallOpenInterest)
        .add(longPutOpenInterest)
        .add(shortPutOpenInterest)

      return {
        id,
        strikePrice,
        skew,
        iv,
        vega,
        gamma,
        isDeltaInRange,
        openInterest,
        longCallOpenInterest,
        shortCallOpenInterest,
        longPutOpenInterest,
        shortPutOpenInterest,
        params,
      }
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, strikeId: number): Promise<Strike> {
    const market = await Market.get(lyra, marketAddressOrName)
    return await market.strike(strikeId)
  }

  async refresh(): Promise<Strike> {
    return Strike.get(this.lyra, this.market().address, this.id)
  }

  // Dynamic Fields

  async ivHistory(lyra: Lyra, options?: SnapshotOptions): Promise<StrikeIVHistory[]> {
    return await fetchStrikeIVHistory(lyra, this, options)
  }

  // Edges

  market(): Market {
    return this.__board.market()
  }

  board(): Board {
    return this.__board
  }

  call(): Option {
    return new Option(this.lyra, this, true, this.block)
  }

  put(): Option {
    return new Option(this.lyra, this, false, this.block)
  }

  option(isCall: boolean): Option {
    return isCall ? this.call() : this.put()
  }

  async quote(isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Promise<Quote> {
    const strike = await this.refresh()
    return strike.quoteSync(isCall, isBuy, size, options)
  }

  quoteSync(isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Quote {
    return this.option(isCall).quoteSync(isBuy, size, options)
  }

  async quoteAll(size: BigNumber, options?: QuoteOptions): Promise<StrikeQuotes> {
    const strike = await this.refresh()
    return strike.quoteAllSync(size, options)
  }

  quoteAllSync(size: BigNumber, options?: QuoteOptions): StrikeQuotes {
    const { bid: callBid, ask: callAsk } = this.option(true).quoteAllSync(size, options)
    const { bid: putBid, ask: putAsk } = this.option(false).quoteAllSync(size, options)
    return {
      strike: this,
      callBid,
      callAsk,
      putBid,
      putAsk,
    }
  }
}
