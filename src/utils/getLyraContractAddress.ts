import { getGlobalDeploys } from '@lyrafinance/protocol'

import { Deployment, LyraContractId } from '../constants/contracts'

export default function getLyraContractAddress(deployment: Deployment, contractId: LyraContractId): string {
  switch (deployment) {
    case Deployment.Kovan:
      return getGlobalDeploys('kovan-ovm')[contractId].address;
    case Deployment.Mainnet:
      return getGlobalDeploys('mainnet-ovm')[contractId].address;
    case Deployment.Local:
      return getGlobalDeploys('local')[contractId].address;
  }
}
