import Lyra from '../lyra'
import getOptionWrapperMarketIds from './getOptionWrapperMarketIds'

export default async function getOptionWrapperMarketId(lyra: Lyra, marketAddress: string): Promise<number | null> {
  const wrapperMarketIds = await getOptionWrapperMarketIds(lyra)
  const marketId = wrapperMarketIds[marketAddress]
  return marketId ?? null
}
