import { BigNumber } from 'ethers'

import { ONE_BN, UNIT } from '../constants/bn'
import { Strike } from '../strike'
import { getDelta } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'
import { QuoteDisabledReason } from '.'

export default function getQuoteDisabledReason(
  strike: Strike,
  size: BigNumber,
  premium: BigNumber,
  newIv: BigNumber,
  newSkew: BigNumber,
  newBaseIv: BigNumber,
  isBuy: boolean,
  isForceClose: boolean
): QuoteDisabledReason | null {
  if (size.isZero()) {
    return QuoteDisabledReason.EmptySize
  }

  const marketView = strike.market().__marketData
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(strike.board())
  if (timeToExpiryAnnualized == 0) {
    return QuoteDisabledReason.Expired
  }

  // Check trading cutoff
  const { tradeLimitParams, greekCacheParams } = marketView.marketParameters
  const isPostCutoff =
    strike.board().__blockTimestamp + tradeLimitParams.tradingCutoff.toNumber() > strike.board().expiryTimestamp
  if (isPostCutoff && !isForceClose) {
    return QuoteDisabledReason.TradingCutoff
  }

  // Check available liquidity
  const { freeLiquidity } = marketView.liquidity
  const spotPrice = strike.market().spotPrice
  const strikePrice = strike.strikePrice
  if (
    // freeLiquidity > amount * (strike or spot)
    (isBuy && (freeLiquidity.lt(size.mul(spotPrice).div(UNIT)) || freeLiquidity.lt(size.mul(strikePrice).div(UNIT)))) ||
    // freeLiquidity > premium
    (!isBuy && freeLiquidity.lt(premium))
  ) {
    return QuoteDisabledReason.InsufficientLiquidity
  }

  // Check delta range
  const rate = greekCacheParams.rateAndCarry
  const callDelta = toBigNumber(
    getDelta(
      timeToExpiryAnnualized,
      fromBigNumber(newIv),
      fromBigNumber(spotPrice),
      fromBigNumber(strikePrice),
      fromBigNumber(rate),
      true
    )
  )

  const minDelta = isForceClose ? tradeLimitParams.minForceCloseDelta : tradeLimitParams.minDelta
  if (!isForceClose && (callDelta.lte(minDelta) || callDelta.gte(ONE_BN.sub(minDelta)))) {
    return QuoteDisabledReason.DeltaOutOfRange
  }

  if (isBuy) {
    if (newBaseIv.gt(tradeLimitParams.maxBaseIV)) {
      return QuoteDisabledReason.IVTooHigh
    } else if (newSkew.gt(tradeLimitParams.maxSkew)) {
      return QuoteDisabledReason.SkewTooHigh
    } else if (newIv.gt(tradeLimitParams.maxVol)) {
      return QuoteDisabledReason.VolTooHigh
    }
  } else {
    if (newBaseIv.lt(tradeLimitParams.minBaseIV)) {
      return QuoteDisabledReason.IVTooHigh
    } else if (newSkew.lt(tradeLimitParams.minSkew)) {
      return QuoteDisabledReason.SkewTooHigh
    } else if (newIv.lt(tradeLimitParams.minVol)) {
      return QuoteDisabledReason.VolTooHigh
    }
  }

  return null
}
