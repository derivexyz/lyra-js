import { Market } from '../market'
import findMarket from './findMarket'

export default function findMarketX(markets: Market[], marketAddressOrName: string): Market {
  const market = findMarket(markets, marketAddressOrName)
  if (!market) {
    throw new Error('Failed to find market')
  }
  return market
}
