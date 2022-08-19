import Lyra from '..'
import { LYRA_OPTIMISM_MAINNET_ADDRESS } from '../constants/contracts'
import fetchTokenSpotPrice from './fetchTokenSpotPrice'

export default async function fetchLyraTokenSpotPrice(lyra: Lyra): Promise<number> {
  return fetchTokenSpotPrice(lyra, LYRA_OPTIMISM_MAINNET_ADDRESS)
}
