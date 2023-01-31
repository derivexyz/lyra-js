import { isAddress } from '@ethersproject/address'

import { LyraContractId } from '../constants/contracts'
import { BoardViewStructOutput } from '../constants/views'
import Lyra, { Version } from '../lyra'
import getLyraContract from './getLyraContract'
import parseBaseKeyBytes32 from './parseBaseKeyBytes32'
import parseBaseSymbol from './parseBaseSymbol'

export default async function getBoardView(
  lyra: Lyra,
  marketAddressOrName: string,
  boardId: number
): Promise<BoardViewStructOutput> {
  if (isAddress(marketAddressOrName)) {
    const viewer = getLyraContract(lyra, lyra.version, LyraContractId.OptionMarketViewer)
    return await viewer.getBoard(marketAddressOrName, boardId)
  } else {
    const baseSymbol = parseBaseSymbol(lyra, marketAddressOrName)
    switch (lyra.version) {
      case Version.Avalon:
        return getLyraContract(lyra, lyra.version, LyraContractId.OptionMarketViewer).getBoardForBaseKey(
          parseBaseKeyBytes32(baseSymbol),
          boardId
        )
      case Version.Newport:
        return getLyraContract(lyra, lyra.version, LyraContractId.OptionMarketViewer).getBoardForBase(
          baseSymbol,
          boardId
        )
    }
  }
}
