import { LyraContractId } from '../constants/contracts'
import { BoardViewStructOutput } from '../constants/views'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

export default async function getBoardViewForStrikeId(
  lyra: Lyra,
  marketAddressOrName: string,
  strikeId: number
): Promise<BoardViewStructOutput> {
  const viewer = getLyraContract(lyra, LyraContractId.OptionMarketViewer)
  return await viewer.getBoardForStrikeId(marketAddressOrName, strikeId)
}
