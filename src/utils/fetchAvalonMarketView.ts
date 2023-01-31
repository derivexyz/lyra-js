import { isAddress } from '@ethersproject/address'

import { LyraContractId } from '../constants/contracts'
import { LyraContractMap } from '../constants/mappings'
import { OptionMarketViewer } from '../contracts/avalon/typechain/AvalonOptionMarketViewer'
import Lyra, { Version } from '../lyra'
import getLyraContract from './getLyraContract'
import multicall, { MulticallRequest } from './multicall'
import parseBaseKeyBytes32 from './parseBaseKeyBytes32'
import parseBaseSymbol from './parseBaseSymbol'

type RequestIsGlobalPaused = MulticallRequest<LyraContractMap<any, LyraContractId.ExchangeAdapter>, 'isGlobalPaused'>
type RequestGlobalOwner = MulticallRequest<LyraContractMap<any, LyraContractId.ExchangeAdapter>, 'owner'>

export default async function fetchAvalonMarketView(
  lyra: Lyra,
  marketAddressOrName: string
): Promise<{
  marketView: OptionMarketViewer.MarketViewWithBoardsStructOutput
  isGlobalPaused: boolean
  owner: string
  blockNumber: number
}> {
  const viewerContract = getLyraContract(lyra, Version.Avalon, LyraContractId.OptionMarketViewer)
  const exchangeContract = getLyraContract(lyra, Version.Avalon, LyraContractId.ExchangeAdapter)
  const isGlobalPausedReq: RequestIsGlobalPaused = {
    contract: exchangeContract,
    function: 'isGlobalPaused',
    args: [],
  }
  const globalOwner: RequestGlobalOwner = {
    contract: exchangeContract,
    function: 'owner',
    args: [],
  }
  if (isAddress(marketAddressOrName)) {
    const {
      returnData: [marketView, isGlobalPaused, owner],
      blockNumber,
    } = await multicall<
      [
        MulticallRequest<LyraContractMap<Version.Avalon, LyraContractId.OptionMarketViewer>, 'getMarket'>,
        RequestIsGlobalPaused,
        RequestGlobalOwner
      ]
    >(lyra, [
      {
        contract: viewerContract,
        function: 'getMarket',
        args: [marketAddressOrName],
      },
      isGlobalPausedReq,
      globalOwner,
    ])
    return { marketView, isGlobalPaused, owner, blockNumber }
  } else {
    const baseSymbol = parseBaseSymbol(lyra, marketAddressOrName)
    const {
      returnData: [marketView, isGlobalPaused, owner],
      blockNumber,
    } = await multicall<
      [
        MulticallRequest<LyraContractMap<Version.Avalon, LyraContractId.OptionMarketViewer>, 'getMarketForBaseKey'>,
        RequestIsGlobalPaused,
        RequestGlobalOwner
      ]
    >(lyra, [
      {
        contract: viewerContract,
        function: 'getMarketForBaseKey',
        args: [parseBaseKeyBytes32(baseSymbol)],
      },
      isGlobalPausedReq,
      globalOwner,
    ])
    return { marketView, isGlobalPaused, owner, blockNumber }
  }
}
