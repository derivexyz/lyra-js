import { isAddress } from '@ethersproject/address'

import { LyraContractId } from '../constants/contracts'
import { BoardViewStructOutput } from '../constants/views'
import { OptionMarketViewer as OptionMarketViewerAvalon } from '../contracts/avalon/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain'
import Lyra, { Version } from '../lyra'
import getLyraContract from './getLyraContract'
import parseBaseKeyBytes32 from './parseBaseKeyBytes32'
import parseBaseSymbol from './parseBaseSymbol'

export default async function getBoardView(
  lyra: Lyra,
  marketAddressOrName: string,
  boardId: number
): Promise<BoardViewStructOutput> {
  const _viewer = getLyraContract(lyra, LyraContractId.OptionMarketViewer)
  if (isAddress(marketAddressOrName)) {
    return await _viewer.getBoard(marketAddressOrName, boardId)
  } else {
    const baseSymbol = parseBaseSymbol(lyra, marketAddressOrName)
    if (lyra.version === Version.Avalon) {
      const avalonViewer = _viewer as OptionMarketViewerAvalon
      return await avalonViewer.getBoardForBaseKey(parseBaseKeyBytes32(baseSymbol), boardId)
    }
    const viewer = _viewer as OptionMarketViewer
    return await viewer.getBoardForBase(baseSymbol, boardId)
  }
}
