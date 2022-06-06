import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { Quote, QuoteOptions } from '../quote'
import { Strike } from '../strike'
import { getBlackScholesPrice, getDelta, getRho, getTheta } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'

export class Option {
  private __strike: Strike
  __source = DataSource.ContractCall
  isCall: boolean
  price: BigNumber
  longOpenInterest: BigNumber
  shortOpenInterest: BigNumber
  delta: BigNumber
  theta: BigNumber
  rho: BigNumber
  isInTheMoney: boolean

  constructor(strike: Strike, isCall: boolean) {
    this.__strike = strike
    this.isCall = isCall
    const fields = Option.getFields(strike, isCall)
    this.price = fields.price
    this.longOpenInterest = fields.longOpenInterest
    this.shortOpenInterest = fields.shortOpenInterest
    this.delta = fields.delta
    this.rho = fields.rho
    this.theta = fields.theta
    this.isInTheMoney = fields.isInTheMoney
  }

  // TODO: @earthtojake Remove getFields
  static getFields(
    strike: Strike,
    isCall: boolean
  ): {
    longOpenInterest: BigNumber
    shortOpenInterest: BigNumber
    price: BigNumber
    delta: BigNumber
    theta: BigNumber
    rho: BigNumber
    isInTheMoney: boolean
  } {
    const strikeView = strike.__strikeData
    const marketView = strike.market().__marketData

    const timeToExpiryAnnualized = getTimeToExpiryAnnualized(strike.board())
    const spotPrice = strike.board().spotPriceAtExpiry ?? strike.market().spotPrice
    const isInTheMoney = isCall ? spotPrice.gt(strike.strikePrice) : spotPrice.lt(strike.strikePrice)

    if (timeToExpiryAnnualized === 0) {
      return {
        longOpenInterest: ZERO_BN,
        shortOpenInterest: ZERO_BN,
        price: ZERO_BN,
        delta: ZERO_BN,
        theta: ZERO_BN,
        rho: ZERO_BN,
        isInTheMoney,
      }
    } else {
      const longOpenInterest = isCall ? strikeView.longCallOpenInterest : strikeView.longPutOpenInterest
      const shortOpenInterest = isCall
        ? strikeView.shortCallBaseOpenInterest.add(strikeView.shortCallQuoteOpenInterest)
        : strikeView.shortPutOpenInterest

      const spotPrice = fromBigNumber(marketView.exchangeParams.spotPrice)
      const strikePriceNum = fromBigNumber(strikeView.strikePrice)
      const rate = fromBigNumber(marketView.marketParameters.greekCacheParams.rateAndCarry)
      const strikeIV = fromBigNumber(strike.iv)

      const price = toBigNumber(
        getBlackScholesPrice(timeToExpiryAnnualized, strikeIV, spotPrice, strikePriceNum, rate, isCall)
      )

      const delta =
        strikeIV > 0
          ? toBigNumber(getDelta(timeToExpiryAnnualized, strikeIV, spotPrice, strikePriceNum, rate, isCall))
          : ZERO_BN

      const theta =
        strikeIV > 0
          ? toBigNumber(getTheta(timeToExpiryAnnualized, strikeIV, spotPrice, strikePriceNum, rate, isCall))
          : ZERO_BN

      const rho =
        strikeIV > 0
          ? toBigNumber(getRho(timeToExpiryAnnualized, strikeIV, spotPrice, strikePriceNum, rate, isCall))
          : ZERO_BN

      return {
        longOpenInterest,
        shortOpenInterest,
        price,
        delta,
        theta,
        rho,
        isInTheMoney,
      }
    }
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, strikeId: number, isCall: boolean): Promise<Option> {
    const market = await Market.get(lyra, marketAddressOrName)
    return await market.option(strikeId, isCall)
  }

  // Edges

  market(): Market {
    return this.__strike.market()
  }

  board(): Board {
    return this.__strike.board()
  }

  strike(): Strike {
    return this.__strike
  }

  // Quote

  quoteSync(isBuy: boolean, size: BigNumber, options?: QuoteOptions): Quote {
    return Quote.get(this, isBuy, size, options)
  }

  async quote(isBuy: boolean, size: BigNumber, options?: QuoteOptions): Promise<Quote> {
    return await this.strike().quote(this.isCall, isBuy, size, options)
  }
}
