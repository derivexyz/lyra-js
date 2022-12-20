import Lyra, { Version } from '..'
import { Deployment, LyraContractId } from '../constants/contracts'
import { Network } from '../constants/network'
import AVALON_MAINNET_ADDRESS_MAP from '../contracts/avalon/addresses/mainnet.addresses.json'
import AVALON_TESTNET_ADDRESS_MAP from '../contracts/avalon/addresses/testnet.addresses.json'
import COMMON_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/arbitrum-goerli.addresses.json'
import COMMON_OPTIMISM_MAINNET_ADDRESS_MAP from '../contracts/common/addresses/optimism.addresses.json'
import COMMON_OPTIMISM_TESTNET_ADDRESS_MAP from '../contracts/common/addresses/optimism-goerli.addresses.json'
import NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP from '../contracts/newport/addresses/arbitrum-goerli.addresses.json'
import NEWPORT_OPTIMISM_MAINNET_ADDRESS_MAP from '../contracts/newport/addresses/optimism.addresses.json'
import NEWPORT_OPTIMISM_TESTNET_ADDRESS_MAP from '../contracts/newport/addresses/optimism-goerli.addresses.json'

const getAvalonAddressMap = (deployment: Deployment) => {
  const testnetAddressMap = AVALON_TESTNET_ADDRESS_MAP
  const mainnetAddressMap = AVALON_MAINNET_ADDRESS_MAP
  return deployment === Deployment.Mainnet ? mainnetAddressMap : testnetAddressMap
}

const getNetworkContractAddresses = (network: Network) => {
  switch (network) {
    case Network.Arbitrum:
      return {
        goerliAddressMap: NEWPORT_ARBITRUM_TESTNET_ADDRESS_MAP,
        // TODO @michaelxuwu update this with arbitrum mainnet addresses
        mainnetAddressMap: {},
      }
    default:
      return {
        goerliAddressMap: NEWPORT_OPTIMISM_TESTNET_ADDRESS_MAP,
        mainnetAddressMap: NEWPORT_OPTIMISM_MAINNET_ADDRESS_MAP,
      }
  }
}

const getCommonAddressMap = (network: Network, deployment: Deployment) => {
  switch (network) {
    case Network.Arbitrum:
      return COMMON_ARBITRUM_TESTNET_ADDRESS_MAP
    case Network.Optimism:
      return deployment === Deployment.Mainnet
        ? COMMON_OPTIMISM_MAINNET_ADDRESS_MAP
        : COMMON_OPTIMISM_TESTNET_ADDRESS_MAP
  }
}

const getAddressMap = (lyra: Lyra): Record<string, string> => {
  const { version, network, deployment } = lyra
  const commonAddressMap = getCommonAddressMap(network, deployment)
  if (version === Version.Avalon) {
    return { ...getAvalonAddressMap(deployment), ...commonAddressMap }
  }
  const { goerliAddressMap, mainnetAddressMap } = getNetworkContractAddresses(network)
  return deployment === Deployment.Mainnet
    ? { ...mainnetAddressMap, ...commonAddressMap }
    : { ...goerliAddressMap, ...commonAddressMap }
}

export default function getLyraContractAddress(lyra: Lyra, contractId: LyraContractId): string {
  const addressMap = getAddressMap(lyra)
  const address = addressMap[contractId]
  if (!address) {
    throw new Error(`Global contract address not found: ${contractId}`)
  }
  return address
}
