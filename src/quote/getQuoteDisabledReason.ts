import { BigNumber } from '@ethersproject/bignumber'

import { ONE_BN, UNIT } from '../constants/bn'
import { Option } from '../option'
import { getDelta } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'
import { QuoteDisabledReason } from '.'

export default function getQuoteDisabledReason(
  option: Option,
  size: BigNumber,
  premium: BigNumber,
  newIv: BigNumber,
  newSkew: BigNumber,
  newBaseIv: BigNumber,
  isBuy: boolean,
  isForceClose: boolean
): QuoteDisabledReason | null {
  const market = option.market()
  const board = option.board()
  const strike = option.strike()
  const marketView = market.__marketData
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(board)
  if (timeToExpiryAnnualized == 0) {
    return QuoteDisabledReason.Expired
  }

  if (size.lte(0)) {
    return QuoteDisabledReason.EmptySize
  }

  if (premium.lte(0)) {
    return QuoteDisabledReason.EmptyPremium
  }

  // Check trading cutoff
  const { tradeLimitParams, greekCacheParams } = marketView.marketParameters
  const isPostCutoff = board.block.timestamp + tradeLimitParams.tradingCutoff.toNumber() > board.expiryTimestamp
  if (isPostCutoff && !isForceClose) {
    return QuoteDisabledReason.TradingCutoff
  }

  const spotPrice = market.spotPrice
  const strikePrice = strike.strikePrice

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

  // Check available liquidity
  const { freeLiquidity } = marketView.liquidity
  if (
    // Must be opening trade
    !isForceClose &&
    (isBuy
      ? option.isCall
        ? freeLiquidity.lt(size.mul(spotPrice).div(UNIT))
        : freeLiquidity.lt(size.mul(strikePrice).div(UNIT))
      : freeLiquidity.lt(premium))
  ) {
    return QuoteDisabledReason.InsufficientLiquidity
  }

  return null
}
