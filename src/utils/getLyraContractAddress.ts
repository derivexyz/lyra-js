import { Deployment, LyraContractId } from '../constants/contracts'
import MAINNET_ADDRESS_MAP from '../contracts/addresses/mainnet.addresses.json'
import MAINNET_MISC_ADDRESS_MAP from '../contracts/addresses/mainnet-misc.addresses.json'
import TESTNET_ADDRESS_MAP from '../contracts/addresses/testnet.addresses.json'
import TESTNET_MISC_ADDRESS_MAP from '../contracts/addresses/testnet-misc.addresses.json'

const getAddressMap = (deployment: Deployment, contractId: LyraContractId): Record<string, string> => {
  const goerliAddressMap = TESTNET_ADDRESS_MAP
  const goerliMiscAddressMap = TESTNET_MISC_ADDRESS_MAP
  const mainnetAddressMap = MAINNET_ADDRESS_MAP
  const mainnetMiscAddressMap = MAINNET_MISC_ADDRESS_MAP
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
    case LyraContractId.OptionMarketWrapper:
    case LyraContractId.SynthetixAdapter:
    case LyraContractId.TestFaucet:
    case LyraContractId.LyraRegistry:
      return deployment === Deployment.Testnet
        ? goerliAddressMap
        : deployment === Deployment.Mainnet
        ? mainnetAddressMap
        : {}
    case LyraContractId.LyraStakingModuleProxy:
    case LyraContractId.MultiDistributor:
    case LyraContractId.ArrakisPool:
    case LyraContractId.WethLyraStakingRewards:
      return deployment === Deployment.Testnet
        ? goerliMiscAddressMap
        : deployment === Deployment.Mainnet
        ? mainnetMiscAddressMap
        : {}
  }
}

export default function getLyraContractAddress(deployment: Deployment, contractId: LyraContractId): string {
  const addressMap = getAddressMap(deployment, contractId)
  const address = addressMap[contractId]
  if (!address) {
    throw new Error('Global contract address not found')
  }
  return address
}
