import { ethers } from 'ethers'

import { LyraContractId } from '../constants/contracts'
import { OptionMarketViewer } from '../contracts/typechain'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'
import parseBaseKey from './parseBaseKey'

export default async function getMarketView(
  lyra: Lyra,
  marketAddressOrName: string
): Promise<OptionMarketViewer.MarketViewWithBoardsStructOutput> {
  const viewer = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer)
  if (ethers.utils.isAddress(marketAddressOrName)) {
    return await viewer.getMarket(marketAddressOrName)
  } else {
    const baseKey = parseBaseKey(marketAddressOrName)
    return await viewer.getMarketForBaseKey(baseKey)
  }
}
