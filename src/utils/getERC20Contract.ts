import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
// todo: should be able to just directly load in abi (instead of loading all global contracts)
// import ERC20_ARTIFACT = require('@lyrafinance/protocol/dist/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json')
import { getGlobalDeploys } from '@lyrafinance/protocol';
import { ERC20 } from '@lyrafinance/protocol/dist/typechain-types/';

export default function getERC20Contract(provider: JsonRpcProvider, address: string): ERC20 {
  const abi = (getGlobalDeploys('kovan-ovm')).QuoteAsset.abi;
  return new Contract(address, abi, provider) as ERC20
  // return new Contract(address, ERC20_ARTIFACT.abi, provider) as ERC20
}