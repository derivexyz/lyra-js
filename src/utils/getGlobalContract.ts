import { Contract, ContractInterface } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import Lyra, { Chain } from '..'
import { LyraGlobalContractId } from '../constants/contracts'
import { LyraGlobalContractMap } from '../constants/mappings'
import LYRA_STAKING_MODULE_ABI from '../contracts/common/abis/LyraStakingModule.json'
import MULTICALL_3_ABI from '../contracts/common/abis/Multicall3.json'
import MULTIDISTRIBUTOR_ABI from '../contracts/common/abis/MultiDistributor.json'
import COMMON_ARBITRUM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/arbitrum.addresses.json'
import COMMON_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/arbitrum-goerli.addresses.json'
import COMMON_ETHEREUM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/ethereum.addresses.json'
import COMMON_ETHEREUM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/ethereum-goerli.addresses.json'
import COMMON_OPTIMISM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/optimism.addresses.json'
import COMMON_OPTIMISM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/optimism-goerli.addresses.json'

const getGlobalContractAddress = (
  lyra: Lyra,
  contractId: LyraGlobalContractId,
  customChainId?: number
): string | undefined => {
  if (customChainId === 1) {
    return (COMMON_ETHEREUM_MAINNET_ADDRESS_MAP as Record<string, string>)[contractId]
  } else if (customChainId === 5) {
    return (COMMON_ETHEREUM_TESTNET_ADDRESS_MAP as Record<string, string>)[contractId]
  }
  switch (lyra.chain) {
    case Chain.Arbitrum:
      return (COMMON_ARBITRUM_MAINNET_ADDRESS_MAP as Record<string, string>)[contractId]
    case Chain.ArbitrumGoerli:
      return (COMMON_ARBITRUM_TESTNET_ADDRESS_MAP as Record<string, string>)[contractId]
    case Chain.Optimism:
      return (COMMON_OPTIMISM_MAINNET_ADDRESS_MAP as Record<string, string>)[contractId]
    case Chain.OptimismGoerli:
      return (COMMON_OPTIMISM_TESTNET_ADDRESS_MAP as Record<string, string>)[contractId]
  }
}

const getGlobalContractABI = (contractId: LyraGlobalContractId): ContractInterface => {
  switch (contractId) {
    case LyraGlobalContractId.LyraStakingModule:
      return LYRA_STAKING_MODULE_ABI
    case LyraGlobalContractId.MultiDistributor:
      return MULTIDISTRIBUTOR_ABI
    case LyraGlobalContractId.Multicall3:
      return MULTICALL_3_ABI
  }
}

export default function getGlobalContract<C extends LyraGlobalContractId>(
  lyra: Lyra,
  contractId: C,
  customProvider?: JsonRpcProvider
): LyraGlobalContractMap[C] {
  const { provider } = lyra
  const address = getGlobalContractAddress(lyra, contractId, customProvider?.network.chainId)
  if (!address) {
    throw new Error('Contract does not exist for specified chain')
  }
  const abi = getGlobalContractABI(contractId)
  return new Contract(address, abi, customProvider ? customProvider : provider) as LyraGlobalContractMap[C]
}
