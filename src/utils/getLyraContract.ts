import { Contract, ContractInterface } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import Lyra, { Chain, Version } from '..'
import { LyraContractId } from '../constants/contracts'
import { LyraContractMap } from '../constants/mappings'
import AVALON_LYRA_REGISTRY_ABI from '../contracts/avalon/abis/AvalonLyraRegistry.json'
import AVALON_OPTION_MARKET_VIEWER_ABI from '../contracts/avalon/abis/AvalonOptionMarketViewer.json'
import AVALON_SYNTHETIX_ADAPTER_ABI from '../contracts/avalon/abis/AvalonSynthetixAdapter.json'
import AVALON_TEST_FAUCET_ABI from '../contracts/avalon/abis/AvalonTestFaucet.json'
import AVALON_MAINNET_ADDRESS_MAP from '../contracts/avalon/addresses/mainnet.addresses.json'
import AVALON_TESTNET_ADDRESS_MAP from '../contracts/avalon/addresses/testnet.addresses.json'
import NEWPORT_GMX_ADAPTER_ABI from '../contracts/newport/abis/NewportGMXAdapter.json'
import NEWPORT_LYRA_REGISTRY_ABI from '../contracts/newport/abis/NewportLyraRegistry.json'
import NEWPORT_OPTION_MARKET_VIEWER_ABI from '../contracts/newport/abis/NewportOptionMarketViewer.json'
import NEWPORT_TEST_FAUCET_ABI from '../contracts/newport/abis/NewportTestFaucet.json'
import NEWPORT_ARBITRUM_MAINNET_ADDRESS_MAP from '../contracts/newport/addresses/arbitrum.addresses.json'
import NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/newport/addresses/arbitrum-goerli.addresses.json'

export const getLyraContractAddress = (
  chain: Chain | 'ethereum',
  version: Version,
  contractId: LyraContractId
): string => {
  switch (chain) {
    case Chain.Arbitrum:
      switch (version) {
        case Version.Avalon:
          throw new Error('Version.Avalon not supported on Arbitrum')
        case Version.Newport:
          return NEWPORT_ARBITRUM_MAINNET_ADDRESS_MAP[contractId]
      }
      break
    case Chain.ArbitrumGoerli:
      switch (version) {
        case Version.Avalon:
          throw new Error('Version.Avalon not supported on Arbitrum Goerli')
        case Version.Newport:
          return NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP[contractId]
      }
      break
    case 'ethereum':
    case Chain.Optimism:
      switch (version) {
        case Version.Avalon:
          return AVALON_MAINNET_ADDRESS_MAP[contractId]
        case Version.Newport:
          throw new Error('Version.Newport not supported on Optimism')
      }
      break
    case Chain.OptimismGoerli:
      switch (version) {
        case Version.Avalon:
          return AVALON_TESTNET_ADDRESS_MAP[contractId]
        case Version.Newport:
          throw new Error('Version.Newport not supported on Optimism Goerli')
      }
      break
  }
}

export const getLyraContractABI = (version: Version, contractId: LyraContractId): ContractInterface => {
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
      switch (version) {
        case Version.Avalon:
          return AVALON_OPTION_MARKET_VIEWER_ABI
        case Version.Newport:
          return NEWPORT_OPTION_MARKET_VIEWER_ABI
      }
      break
    case LyraContractId.LyraRegistry:
      switch (version) {
        case Version.Avalon:
          return AVALON_LYRA_REGISTRY_ABI
        case Version.Newport:
          return NEWPORT_LYRA_REGISTRY_ABI
      }
      break
    case LyraContractId.ExchangeAdapter:
      switch (version) {
        case Version.Avalon:
          return AVALON_SYNTHETIX_ADAPTER_ABI
        case Version.Newport:
          return NEWPORT_GMX_ADAPTER_ABI
      }
      break

    case LyraContractId.TestFaucet:
      switch (version) {
        case Version.Avalon:
          return AVALON_TEST_FAUCET_ABI
        case Version.Newport:
          return NEWPORT_TEST_FAUCET_ABI
      }
      break
  }
}

// TODO: @dappbeast Breakdown lyra components
export default function getLyraContract<V extends Version, C extends LyraContractId>(
  lyra: Lyra,
  version: V,
  contractId: C,
  useCustomProvider?: JsonRpcProvider
): LyraContractMap<V, C> {
  const { provider } = lyra
  const address = getLyraContractAddress(lyra.chain, version, contractId)
  const abi = getLyraContractABI(version, contractId)
  return new Contract(address, abi, useCustomProvider ? useCustomProvider : provider) as LyraContractMap<V, C>
}
