import { BigNumber } from '@ethersproject/bignumber'
import { Block } from '@ethersproject/providers'

import { Board } from '../board'
import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
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
  iv: BigNumber
  timestamp: number
}

export class Strike {
  private lyra: Lyra
  private __board: Board
  __strikeData: OptionMarketViewer.StrikeViewStructOutput
  __source = DataSource.ContractCall
  block: Block
  id: number
  strikePrice: BigNumber
  skew: BigNumber
  iv: BigNumber
  vega: BigNumber
  gamma: BigNumber
  isDeltaInRange: boolean

  constructor(lyra: Lyra, board: Board, strikeId: number, block: Block) {
    this.lyra = lyra
    this.__board = board
    const strikeView = board.__boardData.strikes.find(strikeView => strikeView.strikeId.toNumber() === strikeId)
    if (!strikeView) {
      throw new Error('Strike does not exist for board')
    }
    this.__strikeData = strikeView
    const fields = Strike.getFields(board, strikeId)
    this.block = block
    this.id = fields.id
    this.strikePrice = fields.strikePrice
    this.skew = fields.skew
    this.iv = fields.iv
    this.vega = fields.vega
    this.gamma = fields.gamma
    this.isDeltaInRange = fields.isDeltaInRange
  }

  private static getFields(board: Board, strikeId: number) {
    const strikeView = board.__boardData.strikes.find(strikeView => strikeView.strikeId.toNumber() === strikeId)
    if (!strikeView) {
      throw new Error('Strike does not exist for board')
    }
    const id = strikeView.strikeId.toNumber()
    const strikePrice = strikeView.strikePrice
    const timeToExpiryAnnualized = getTimeToExpiryAnnualized(board)
    const skew = strikeView.skew
    const iv = board.baseIv.mul(strikeView.skew).div(UNIT)
    if (timeToExpiryAnnualized === 0) {
      return {
        id,
        strikePrice,
        skew: ZERO_BN,
        iv: ZERO_BN,
        vega: ZERO_BN,
        gamma: ZERO_BN,
        isDeltaInRange: false,
      }
    } else {
      const ivNum = fromBigNumber(iv)
      const spotPrice = fromBigNumber(board.market().spotPrice)
      const strikePriceNum = fromBigNumber(strikePrice)
      const rate = fromBigNumber(board.market().__marketData.marketParameters.greekCacheParams.rateAndCarry)
      const vega =
        ivNum > 0 ? toBigNumber(getVega(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate)) : ZERO_BN
      const gamma =
        ivNum > 0 ? toBigNumber(getGamma(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate)) : ZERO_BN
      const callDelta =
        ivNum > 0
          ? toBigNumber(getDelta(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate, true))
          : ZERO_BN
      const minDelta = board.market().__marketData.marketParameters.tradeLimitParams.minDelta
      const isDeltaInRange = callDelta.gte(minDelta) && callDelta.lte(ONE_BN.sub(minDelta))
      return {
        id,
        strikePrice,
        skew,
        iv,
        vega,
        gamma,
        isDeltaInRange,
      }
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, strikeId: number): Promise<Strike> {
    const market = await Market.get(lyra, marketAddressOrName)
    return await market.strike(strikeId)
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

  // Quote

  async quote(isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Promise<Quote> {
    return await this.market().quote(this.id, isCall, isBuy, size, options)
  }

  // Implied Volatility History

  async ivHistory(lyra: Lyra, options?: StrikeHistoryOptions): Promise<StrikeIVHistory[]> {
    const { startTimestamp = 0 } = options ?? {}
    const marketAddress = this.market().address
    const strikeId = `${marketAddress.toLowerCase()}-${this.id}`
    return await fetchStrikeIVHistory(lyra, strikeId, startTimestamp, this.block.timestamp)
  }
}
