import Lyra, { MarketLiquidity } from '..'
import fetchLatestLiquidity from './fetchLatestLiquidity'

export type MarketAddressToLiquidity = {
  [marketAddress: string]: MarketLiquidity
}

export default async function getMarketsLiquidity(
  lyra: Lyra,
  marketAddresses: string[]
): Promise<MarketAddressToLiquidity> {
  const marketsLiquidity = await Promise.all(marketAddresses.map(address => fetchLatestLiquidity(lyra, address)))
  return marketsLiquidity.reduce((marketToLiquidity, marketLiquidity, idx) => {
    return {
      ...marketToLiquidity,
      [marketAddresses[idx]]: marketLiquidity,
    }
  }, {})
}
