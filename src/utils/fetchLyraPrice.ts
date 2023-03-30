import Lyra from '../lyra'
import fetchWithCache from './fetchWithCache'

export default async function fetchLyraPrice(lyra: Lyra): Promise<number> {
  const res = await fetchWithCache<{ spotPrice: number }>(`${lyra.apiUri}/lyra-price`)
  return res.spotPrice
}
