import { Deployment, LyraContractId } from '../constants/contracts'

export default function getLyraContractAddress(deployment: Deployment, contractId: LyraContractId): string {
  const addressMap = require(`../contracts/addresses/${deployment}.addresses.json`) // eslint-disable-line
  return addressMap[contractId]
}
