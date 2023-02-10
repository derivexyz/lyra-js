import { Contract, ContractInterface } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import Lyra, { Chain } from '..'
import { LyraGlobalContractId } from '../constants/contracts'
import { LyraGlobalContractMap } from '../constants/mappings'
import ARRAKIS_POOL_L1_ABI from '../contracts/common/abis/ArrakisPoolL1.json'
import ARRAKIS_POOL_L2_ABI from '../contracts/common/abis/ArrakisPoolL2.json'
import LYRA_STAKING_MODULE_ABI from '../contracts/common/abis/LyraStakingModule.json'
import MULTICALL_3_ABI from '../contracts/common/abis/Multicall3.json'
import MULTIDISTRIBUTOR_ABI from '../contracts/common/abis/MultiDistributor.json'
import TOKEN_MIGRATOR_ABI from '../contracts/common/abis/TokenMigrator.json'
import WETH_LYRA_STAKING_REWARDS_ABI from '../contracts/common/abis/WethLyraStakingRewards.json'
import COMMON_ARBITRUM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/arbitrum.addresses.json'
import COMMON_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/arbitrum-goerli.addresses.json'
import COMMON_ETHEREUM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/ethereum.addresses.json'
import COMMON_OPTIMISM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/optimism.addresses.json'
import COMMON_OPTIMISM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/optimism-goerli.addresses.json'

const getGlobalContractAddress = (
  lyra: Lyra,
  contractId: LyraGlobalContractId,
  useEthereumAddressMap?: boolean
): string | undefined => {
  if (useEthereumAddressMap) {
    return (COMMON_ETHEREUM_MAINNET_ADDRESS_MAP as Record<string, string>)[contractId]
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
    case LyraGlobalContractId.ArrakisPoolL2:
      return ARRAKIS_POOL_L2_ABI
    case LyraGlobalContractId.LyraStakingModule:
      return LYRA_STAKING_MODULE_ABI
    case LyraGlobalContractId.ArrakisPoolL1:
      return ARRAKIS_POOL_L1_ABI
    case LyraGlobalContractId.MultiDistributor:
      return MULTIDISTRIBUTOR_ABI
    case LyraGlobalContractId.Multicall3:
      return MULTICALL_3_ABI
    case LyraGlobalContractId.WethLyraStakingRewardsL1:
    case LyraGlobalContractId.WethLyraStakingRewardsL2:
      return WETH_LYRA_STAKING_REWARDS_ABI
    case LyraGlobalContractId.TokenMigrator:
      return TOKEN_MIGRATOR_ABI
  }
}

export default function getGlobalContract<C extends LyraGlobalContractId>(
  lyra: Lyra,
  contractId: C,
  customProvider?: JsonRpcProvider
): LyraGlobalContractMap[C] {
  const { provider } = lyra
  const address = getGlobalContractAddress(lyra, contractId, customProvider?.network.chainId === 1)
  if (!address) {
    throw new Error('Contract does not exist for specified chain')
  }
  const abi = getGlobalContractABI(contractId)
  return new Contract(address, abi, customProvider ? customProvider : provider) as LyraGlobalContractMap[C]
}
