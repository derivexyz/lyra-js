import { Network } from '../constants/network'
import { GMXAdapter } from '../contracts/newport/typechain/NewportGMXAdapter'
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
  if (
    market.lyra.version === Version.Avalon ||
    !market.params.adapterView ||
    priceType === PriceType.REFERENCE ||
    market.lyra.network === Network.Optimism
  ) {
    return spotPrice
  }
  const gmxAdapterView = market.params.adapterView as GMXAdapter.GMXAdapterStateStructOutput
  if (!gmxAdapterView) {
    throw new Error('Mismatching adapter view and getQuoteSpotPrice')
  }
  const { gmxMaxPrice: forceMaxSpotPrice, gmxMinPrice: forceMinSpotPrice, marketPricingParams } = gmxAdapterView

  const { gmxUsageThreshold } = marketPricingParams
  const minVariance = getPriceVariance(forceMinSpotPrice, spotPrice)
  const maxVariance = getPriceVariance(forceMaxSpotPrice, spotPrice)

  // In the case where the gmxUsageThreshold is crossed, we want to use the worst case price between cl and gmx
  let useWorstCase = false
  if (minVariance.gt(gmxUsageThreshold) || maxVariance.gt(gmxUsageThreshold)) {
    useWorstCase = true
  }

  if (priceType == PriceType.FORCE_MIN || priceType == PriceType.MIN_PRICE) {
    return useWorstCase && forceMinSpotPrice.gt(spotPrice) ? spotPrice : forceMinSpotPrice
  } else {
    return useWorstCase && forceMaxSpotPrice.lt(spotPrice) ? spotPrice : forceMaxSpotPrice
  }
}
