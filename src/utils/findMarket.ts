import { Market } from '../market'
import isMarketEqual from './isMarketEqual'

export default function findMarket(markets: Market[], marketAddressOrName: string): Market | null {
  const market = Object.values(markets).find(market => isMarketEqual(market, marketAddressOrName))
  return market ?? null
}
