import { Version } from '../lyra'
import { Market } from '../market'
import getPriceVariance from './getPriceVariance'

export enum PriceType {
  MIN_PRICE, // minimise the spot based on logic in adapter - can revert
  MAX_PRICE, // maximise the spot based on logic in adapter
  REFERENCE,
  FORCE_MIN, // minimise the spot based on logic in adapter - shouldn't revert unless feeds are compromised
  FORCE_MAX,
}

export default function getQuoteSpotPrice(market: Market, priceType: PriceType) {
  // Reference spot price
  const spotPrice = market.params.referenceSpotPrice
  if (market.lyra.version === Version.Avalon || !market.params.adapterView || priceType === PriceType.REFERENCE) {
    return spotPrice
  }
  const {
    gmxMaxPrice: forceMaxSpotPrice,
    gmxMinPrice: forceMinSpotPrice,
    marketPricingParams,
  } = market.params.adapterView
  const { gmxUsageThreshold } = marketPricingParams
  const minVariance = getPriceVariance(forceMinSpotPrice, spotPrice)
  const maxVariance = getPriceVariance(forceMaxSpotPrice, spotPrice)

  // In the case where the gmxUsageThreshold is crossed, we want to use the worst case price between cl and gmx
  let useWorstCase = false
  if (minVariance > gmxUsageThreshold || maxVariance > gmxUsageThreshold) {
    useWorstCase = true
  }

  if (priceType == PriceType.FORCE_MIN || priceType == PriceType.MIN_PRICE) {
    return useWorstCase && forceMinSpotPrice > spotPrice ? spotPrice : forceMinSpotPrice
  } else {
    return useWorstCase && forceMaxSpotPrice < spotPrice ? spotPrice : forceMaxSpotPrice
  }
}
