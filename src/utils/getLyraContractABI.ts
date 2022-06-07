import { ContractInterface } from '@ethersproject/contracts';
import { getGlobalDeploys,getMarketDeploys } from '@lyrafinance/protocol';

import { LyraContractId, LyraMarketContractId } from '../constants/contracts';

export default function getLyraContractABI(contractId: LyraContractId | LyraMarketContractId): ContractInterface {
  if (contractId == LyraContractId.OptionMarketViewer || 
    contractId == LyraContractId.OptionMarketWrapper ||
    contractId == LyraContractId.TestFaucet ||
    contractId == LyraContractId.SynthetixAdapter) {
      return (getGlobalDeploys('kovan-ovm'))[contractId].abi
  } else {
    return (getMarketDeploys('kovan-ovm', 'sETH'))[contractId].abi
  }
}
