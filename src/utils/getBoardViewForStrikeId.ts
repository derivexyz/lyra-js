import Lyra from '..'
import { LyraContractId } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import getLyraContract from './getLyraContract'

export default async function getBoardViewForStrikeId(
  lyra: Lyra,
  marketAddressOrName: string,
  strikeId: number
): Promise<OptionMarketViewer.BoardViewStructOutput> {
  const viewer = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer)
  return await viewer.getBoardForStrikeId(marketAddressOrName, strikeId)
}
