import { ContractInterface } from '@ethersproject/contracts'

import { LyraContractId, LyraMarketContractId } from '../constants/contracts'

export default function getLyraContractABI(contractId: LyraContractId | LyraMarketContractId): ContractInterface {
  return require('../contracts/abis/' + contractId + '.json') // eslint-disable-line
}
