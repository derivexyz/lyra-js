import { getAddress, isAddress } from '@ethersproject/address'

import { Market } from '../market'
import parseBaseSymbol from './parseBaseSymbol'

export default function isMarketEqual(market: Market, marketAddressOrName: string): boolean {
  if (isAddress(marketAddressOrName)) {
    return market.address === getAddress(marketAddressOrName)
  } else {
    return market.baseToken.symbol === parseBaseSymbol(market.lyra, marketAddressOrName)
  }
}
