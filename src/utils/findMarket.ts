import { Market } from '../market'

export default function findMarket(markets: Market[], marketAddressOrName: string): Market {
  const market = Object.values(markets).find(
    market =>
      market.name.toLowerCase() === marketAddressOrName.toLowerCase() ||
      market.address.toLowerCase() === marketAddressOrName.toLowerCase()
  )
  if (!market) {
    throw new Error('Failed to find market')
  }
  return market
}
