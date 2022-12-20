import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import ERC20_ABI from '../contracts/common/abis/ERC20.json'
import { ERC20 } from '../contracts/common/typechain/ERC20'

export default function getERC20Contract(provider: JsonRpcProvider, address: string): ERC20 {
  return new Contract(address, ERC20_ABI, provider) as ERC20
}
