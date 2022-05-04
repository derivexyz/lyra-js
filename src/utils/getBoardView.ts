import { ethers } from 'ethers'

import { LyraContractId } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'
import parseBaseKey from './parseBaseKey'

export default async function getBoardView(
  lyra: Lyra,
  marketAddressOrName: string,
  boardId: number
): Promise<OptionMarketViewer.BoardViewStructOutput> {
  const viewer = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer)
  if (ethers.utils.isAddress(marketAddressOrName)) {
    return await viewer.getBoard(marketAddressOrName, boardId)
  } else {
    const baseKey = parseBaseKey(marketAddressOrName)
    return await viewer.getBoardForBaseKey(baseKey, boardId)
  }
}
