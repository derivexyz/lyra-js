import { Network } from '../constants/network'
import Lyra from '../lyra'
import fetchWithCache from './fetchWithCache'

export default async function fetchTokenSpotPrice(
  lyra: Lyra,
  tokenAddressOrName: string,
  network: Network | 'ethereum'
): Promise<number> {
  const url = new URL(`/token-price?tokenAddressOrName=${tokenAddressOrName}&network=${network}`, lyra.apiUri)
  const res = await fetchWithCache<{ spotPrice: number }>(url.toString())
  return res.spotPrice
}
