import { Deployment, LyraContractId } from '../constants/contracts'
import KOVAN_ADDRESS_MAP from '../contracts/addresses/kovan.addresses.json'
// TODO: @earthtojake Use @lyrafinance/protocol to get addresses
import LOCAL_ADDRESS_MAP from '../contracts/addresses/local.addresses.json'
import MAINNET_ADDRESS_MAP from '../contracts/addresses/mainnet.addresses.json'

export default function getLyraContractAddress(deployment: Deployment, contractId: LyraContractId): string {
  switch (deployment) {
    case Deployment.Kovan:
      return (KOVAN_ADDRESS_MAP as Record<LyraContractId, string>)[contractId]
    case Deployment.Mainnet:
      return (MAINNET_ADDRESS_MAP as Record<LyraContractId, string>)[contractId]
    case Deployment.Local:
      return (LOCAL_ADDRESS_MAP as Record<LyraContractId, string>)[contractId]
  }
}
