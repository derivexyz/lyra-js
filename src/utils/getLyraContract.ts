import { Contract } from '@ethersproject/contracts'

import Lyra, { Version } from '..'
import { LyraContractId } from '../constants/contracts'
import { LyraAvalonContractReturnType, LyraContractReturnType } from '../constants/mappings'
import getLyraContractABI from './getLyraContractABI'
import getLyraContractAddress from './getLyraContractAddress'

export default function getLyraContract<T extends LyraContractId>(
  lyra: Lyra,
  contractId: T
): LyraAvalonContractReturnType[T] | LyraContractReturnType[T] {
  const { provider, version } = lyra
  const address = getLyraContractAddress(lyra, contractId)
  const abi = getLyraContractABI(version, contractId)
  switch (version) {
    case Version.Avalon:
      return new Contract(address, abi, provider) as LyraAvalonContractReturnType[T]
    default:
      return new Contract(address, abi, provider) as LyraContractReturnType[T]
  }
}
