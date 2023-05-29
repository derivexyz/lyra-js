import { BigNumber } from '@ethersproject/bignumber'

import { ONE_BN, UNIT } from '../constants/bn'
import { Network } from '../constants/network'
import { GMXAdapter } from '../contracts/newport/typechain/NewportGMXAdapter'
import { Option } from '../option'
import { getDelta } from '../utils/blackScholes'
import canHedge from '../utils/canHedge'
import fromBigNumber from '../utils/fromBigNumber'
import getPriceVariance from '../utils/getPriceVariance'
import getQuoteSpotPrice, { PriceType } from '../utils/getQuoteSpotPrice'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import isTestnet from '../utils/isTestnet'
import toBigNumber from '../utils/toBigNumber'
import { QuoteDisabledReason } from '.'

export default function getQuoteDisabledReason(
  option: Option,
  spotPrice: BigNumber,
  size: BigNumber,
  premium: BigNumber,
  newIv: BigNumber,
  newSkew: BigNumber,
  newBaseIv: BigNumber,
  isBuy: boolean,
  isForceClose: boolean,
  priceType: PriceType,
  isOpen: boolean,
  network: Network
): QuoteDisabledReason | null {
  const market = option.market()
  const board = option.board()
  const strike = option.strike()
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(board)
  if (timeToExpiryAnnualized == 0) {
    return QuoteDisabledReason.Expired
  }

  if (size.lte(0)) {
    return QuoteDisabledReason.EmptySize
  }

  // Check trading cutoff
  const isPostCutoff = board.block.timestamp + market.params.tradingCutoff > board.expiryTimestamp
  if (isPostCutoff && !isForceClose) {
    return QuoteDisabledReason.TradingCutoff
  }

  const strikePrice = strike.strikePrice

  // Check delta range
  const rate = market.params.rateAndCarry
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

  const minDelta = isForceClose ? market.params.minForceCloseDelta : market.params.minDelta
  if (!isForceClose && (callDelta.lte(minDelta) || callDelta.gte(ONE_BN.sub(minDelta)))) {
    return QuoteDisabledReason.DeltaOutOfRange
  }

  // On force close, base iv is not impacted and should never be out of range
  // On force close, skew is impacted and should use abs min / max
  const minSkew = isForceClose ? market.params.absMinSkew : market.params.minSkew
  const maxSkew = isForceClose ? market.params.absMaxSkew : market.params.maxSkew
  if (isBuy) {
    if (newBaseIv.gt(market.params.maxBaseIv)) {
      return QuoteDisabledReason.IVTooHigh
    } else if (newSkew.gt(maxSkew)) {
      return QuoteDisabledReason.SkewTooHigh
    } else if (newIv.gt(market.params.maxVol)) {
      return QuoteDisabledReason.VolTooHigh
    }
  } else {
    if (newBaseIv.lt(market.params.minBaseIv)) {
      return QuoteDisabledReason.IVTooLow
    } else if (newSkew.lt(minSkew)) {
      return QuoteDisabledReason.SkewTooLow
    } else if (newIv.lt(market.params.minVol)) {
      return QuoteDisabledReason.VolTooLow
    }
  }

  // Check available liquidity
  const { freeLiquidity } = market.params
  if (
    // Must be opening trade
    !isForceClose &&
    isOpen &&
    (isBuy
      ? option.isCall
        ? freeLiquidity.lt(size.mul(spotPrice).div(UNIT))
        : freeLiquidity.lt(size.mul(strikePrice).div(UNIT))
      : freeLiquidity.lt(premium))
  ) {
    return QuoteDisabledReason.InsufficientLiquidity
  }

  // Check if hedger can hedge the additional delta risk introduced by the quote.
  const hedgerView = option.market().params.hedgerView
  const poolHedgerParams = option.market().params.poolHedgerParams
  const increasesPoolDelta = (option.delta.lt(0) && isBuy) || (option.delta.gt(0) && !isBuy)
  if (
    hedgerView &&
    poolHedgerParams &&
    isOpen &&
    !isTestnet(option.lyra) &&
    !canHedge(
      getQuoteSpotPrice(market, priceType),
      market.params.netDelta,
      option,
      size,
      increasesPoolDelta,
      hedgerView,
      poolHedgerParams,
      network
    )
  ) {
    return QuoteDisabledReason.UnableToHedgeDelta
  }

  if (market.lyra.network === Network.Arbitrum) {
    // Disable quote for opening and closing in the case where the feeds differ by a great amount, but allow force closes.
    const { adapterView } = option.market().params
    const gmxAdapterView = adapterView as GMXAdapter.GMXAdapterStateStructOutput
    if (gmxAdapterView && !isForceClose && (priceType === PriceType.MAX_PRICE || priceType === PriceType.MIN_PRICE)) {
      const { gmxMaxPrice: forceMaxSpotPrice, gmxMinPrice: forceMinSpotPrice } = gmxAdapterView
      const minPriceVariance = getPriceVariance(forceMinSpotPrice, market.params.referenceSpotPrice)
      const maxPriceVariance = getPriceVariance(forceMaxSpotPrice, market.params.referenceSpotPrice)
      const varianceThreshold = gmxAdapterView.marketPricingParams.priceVarianceCBPercent
      if (minPriceVariance.gt(varianceThreshold) || maxPriceVariance.gt(varianceThreshold)) {
        return QuoteDisabledReason.PriceVarianceTooHigh
      }
    }
  }

  return null
}
