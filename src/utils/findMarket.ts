import { getAddress, isAddress } from '@ethersproject/address'

import Lyra from '../'
import { Market } from '../market'
import parseBaseSymbol from './parseBaseSymbol'

export default function findMarket(lyra: Lyra, markets: Market[], marketAddressOrName: string): Market {
  const market = Object.values(markets).find(market => {
    if (isAddress(marketAddressOrName)) {
      return market.address === getAddress(marketAddressOrName)
    } else {
      return market.baseToken.symbol === parseBaseSymbol(lyra, marketAddressOrName)
    }
  })
  if (!market) {
    throw new Error('Failed to find market')
  }
  return market
}
