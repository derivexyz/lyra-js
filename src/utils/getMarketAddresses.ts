import { LyraContractId } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

export default async function getMarketAddresses(
  lyra: Lyra
): Promise<OptionMarketViewer.OptionMarketAddressesStructOutput[]> {
  // Never runs out of gas
  return await getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer).getMarketAddresses()
}
