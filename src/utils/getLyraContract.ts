import { Contract, ContractInterface } from '@ethersproject/contracts'

import Lyra, { Chain, Network, Version } from '..'
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
import NEWPORT_SYNTHETIX_ADAPTER_ABI from '../contracts/newport/abis/NewportSNXPerpV2Adapter.json'
import NEWPORT_TEST_FAUCET_ABI from '../contracts/newport/abis/NewportTestFaucet.json'
import NEWPORT_ARBITRUM_MAINNET_ADDRESS_MAP from '../contracts/newport/addresses/arbitrum.addresses.json'
import NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/newport/addresses/arbitrum-goerli.addresses.json'
import NEWPORT_OPTIMISM_MAINNET_ADDRESS_MAP from '../contracts/newport/addresses/optimism.addresses.json'
import NEWPORT_OPTIMISM_TESTNET_ADDRESS_MAP from '../contracts/newport/addresses/optimism-goerli.addresses.json'

export const getLyraContractAddress = (chain: Chain, version: Version, contractId: LyraContractId): string => {
  switch (chain) {
    case Chain.Arbitrum:
      switch (version) {
        case Version.Avalon:
          throw new Error('Version.Avalon not supported on Arbitrum')
        case Version.Newport:
          return NEWPORT_ARBITRUM_MAINNET_ADDRESS_MAP[contractId]
      }
    /* eslint-disable-next-line no-fallthrough */
    case Chain.ArbitrumGoerli:
      switch (version) {
        case Version.Avalon:
          throw new Error('Version.Avalon not supported on Arbitrum Goerli')
        case Version.Newport:
          return NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP[contractId]
      }
    /* eslint-disable-next-line no-fallthrough */
    case Chain.Optimism:
      switch (version) {
        case Version.Avalon:
          return AVALON_MAINNET_ADDRESS_MAP[contractId]
        case Version.Newport:
          return NEWPORT_OPTIMISM_MAINNET_ADDRESS_MAP[contractId]
      }
    /* eslint-disable-next-line no-fallthrough */
    case Chain.OptimismGoerli:
      switch (version) {
        case Version.Avalon:
          return AVALON_TESTNET_ADDRESS_MAP[contractId]
        case Version.Newport:
          return NEWPORT_OPTIMISM_TESTNET_ADDRESS_MAP[contractId]
      }
  }
}

export const getLyraContractABI = (
  version: Version,
  contractId: LyraContractId,
  network: Network
): ContractInterface => {
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
      switch (version) {
        case Version.Avalon:
          return AVALON_OPTION_MARKET_VIEWER_ABI
        case Version.Newport:
          return NEWPORT_OPTION_MARKET_VIEWER_ABI
      }
    /* eslint-disable-next-line no-fallthrough */
    case LyraContractId.LyraRegistry:
      switch (version) {
        case Version.Avalon:
          return AVALON_LYRA_REGISTRY_ABI
        case Version.Newport:
          return NEWPORT_LYRA_REGISTRY_ABI
      }
    /* eslint-disable-next-line no-fallthrough */
    case LyraContractId.ExchangeAdapter:
      switch (version) {
        case Version.Avalon:
          return AVALON_SYNTHETIX_ADAPTER_ABI
        case Version.Newport:
          switch (network) {
            case Network.Arbitrum:
              return NEWPORT_GMX_ADAPTER_ABI
            case Network.Optimism:
              return NEWPORT_SYNTHETIX_ADAPTER_ABI
          }
      }
    /* eslint-disable-next-line no-fallthrough */
    case LyraContractId.TestFaucet:
      switch (version) {
        case Version.Avalon:
          return AVALON_TEST_FAUCET_ABI
        case Version.Newport:
          return NEWPORT_TEST_FAUCET_ABI
      }
  }
}

// TODO: @dappbeast Breakdown lyra components
export default function getLyraContract<V extends Version, C extends LyraContractId>(
  lyra: Lyra,
  version: V,
  contractId: C
): LyraContractMap<V, C> {
  const { provider } = lyra
  const address = getLyraContractAddress(lyra.chain, version, contractId)
  const abi = getLyraContractABI(version, contractId, lyra.network)
  return new Contract(address, abi, provider) as LyraContractMap<V, C>
}
