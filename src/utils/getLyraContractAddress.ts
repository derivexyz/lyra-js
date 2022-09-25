import { Deployment, LyraContractId } from '../constants/contracts'
import KOVAN_ADDRESS_MAP from '../contracts/addresses/kovan.addresses.json'
import KOVAN_MISC_ADDRESS_MAP from '../contracts/addresses/kovan-misc.addresses.json'
import MAINNET_ADDRESS_MAP from '../contracts/addresses/mainnet.addresses.json'
import MAINNET_MISC_ADDRESS_MAP from '../contracts/addresses/mainnet-misc.addresses.json'

const getAddressMap = (deployment: Deployment, contractId: LyraContractId): Record<string, string> => {
  const kovanAddressMap = KOVAN_ADDRESS_MAP
  const kovanMiscAddressMap = KOVAN_MISC_ADDRESS_MAP
  const mainnetAddressMap = MAINNET_ADDRESS_MAP
  const mainnetMiscAddressMap = MAINNET_MISC_ADDRESS_MAP
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
    case LyraContractId.OptionMarketWrapper:
    case LyraContractId.SynthetixAdapter:
    case LyraContractId.TestFaucet:
    case LyraContractId.LyraRegistry:
      return deployment === Deployment.Kovan
        ? kovanAddressMap
        : deployment === Deployment.Mainnet
        ? mainnetAddressMap
        : {}
    case LyraContractId.LyraStakingModuleProxy:
    case LyraContractId.MultiDistributor:
    case LyraContractId.ArrakisPool:
    case LyraContractId.WethLyraStakingRewards:
      return deployment === Deployment.Kovan
        ? kovanMiscAddressMap
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
