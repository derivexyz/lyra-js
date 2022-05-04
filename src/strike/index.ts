import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import Board from '../board'
import { ONE_BN, UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Market from '../market'
import Option from '../option'
import Quote, { QuoteOptions } from '../quote'
import { getDelta, getGamma, getVega } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'

export default class Strike {
  private __board: Board
  __strikeData: OptionMarketViewer.StrikeViewStructOutput
  __source = DataSource.ContractCall
  id: number
  strikePrice: BigNumber
  skew: BigNumber
  iv: BigNumber
  vega: BigNumber
  gamma: BigNumber
  isDeltaInRange: boolean

  constructor(board: Board, strikeId: number) {
    this.__board = board
    const strikeView = board.__boardData.strikes.find(strikeView => strikeView.strikeId.toNumber() === strikeId)
    if (!strikeView) {
      throw new Error('Strike does not exist for board')
    }
    this.__strikeData = strikeView
    const fields = Strike.getFields(board, strikeId)
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
      const skew = strikeView.skew
      const iv = board.baseIv.mul(strikeView.skew).div(UNIT)
      const ivNum = fromBigNumber(board.baseIv.mul(strikeView.skew).div(UNIT))
      const spotPrice = fromBigNumber(board.market().spotPrice)
      const strikePriceNum = fromBigNumber(strikePrice)
      const rate = fromBigNumber(board.market().__marketData.marketParameters.greekCacheParams.rateAndCarry)
      const vega = toBigNumber(getVega(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate))
      const gamma = toBigNumber(getGamma(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate))
      const callDelta = toBigNumber(getDelta(timeToExpiryAnnualized, ivNum, spotPrice, strikePriceNum, rate, true))
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
    return new Option(this, true)
  }

  put(): Option {
    return new Option(this, false)
  }

  option(isCall: boolean): Option {
    return isCall ? this.call() : this.put()
  }

  // Quote

  async quote(isCall: boolean, isBuy: boolean, size: BigNumber, options?: QuoteOptions): Promise<Quote> {
    return await this.market().quote(this.id, isCall, isBuy, size, options)
  }
}
