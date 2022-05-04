import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract } from 'ethers'

import ERC20_ABI from '../contracts/abis/ERC20.json'
import { ERC20 } from '../contracts/typechain/ERC20'

export default function getERC20Contract(provider: JsonRpcProvider, address: string): ERC20 {
  return new Contract(address, ERC20_ABI, provider) as ERC20
}
