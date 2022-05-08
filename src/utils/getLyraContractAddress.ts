import { Deployment, LyraContractId } from '../constants/contracts'
import KOVAN_ADDRESS_MAP from '../contracts/addresses/kovan.addresses.json'
// TODO: Remove local address maps in favor of protocol SDK
import LOCAL_ADDRESS_MAP from '../contracts/addresses/local.addresses.json'

export default function getLyraContractAddress(deployment: Deployment, contractId: LyraContractId): string {
  switch (deployment) {
    case Deployment.Kovan:
      return KOVAN_ADDRESS_MAP[contractId]
    case Deployment.Local:
      return (LOCAL_ADDRESS_MAP as Record<string, string>)[contractId]
  }
}
