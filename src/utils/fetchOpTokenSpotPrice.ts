import Lyra from '..'
import { OP_OPTIMISM_MAINNET_ADDRESS } from '../constants/contracts'
import fetchTokenSpotPrice from './fetchTokenSpotPrice'

export default async function fetchOpTokenSpotPrice(lyra: Lyra): Promise<number> {
  return fetchTokenSpotPrice(lyra, OP_OPTIMISM_MAINNET_ADDRESS)
}
