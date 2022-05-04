import { ethers } from 'ethers'

import Lyra from '../lyra'

export default function buildTx(lyra: Lyra, to: string, from: string, data: string): ethers.PopulatedTransaction {
  return {
    to,
    data,
    from,
    chainId: lyra.provider.network.chainId,
  }
}
