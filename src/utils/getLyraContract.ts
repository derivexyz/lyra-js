import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import { Deployment, LyraContractId } from '../constants/contracts'
import { LyraContractReturnType } from '../constants/mappings'
import getLyraContractABI from './getLyraContractABI'
import getLyraContractAddress from './getLyraContractAddress'

export default function getLyraContract<T extends LyraContractId>(
  provider: JsonRpcProvider,
  deployment: Deployment,
  contractId: T
): LyraContractReturnType[T] {
  const address = getLyraContractAddress(deployment, contractId)
  const abi = getLyraContractABI(contractId)
  return new Contract(address, abi, provider) as LyraContractReturnType[T]
}
