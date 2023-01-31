import { BigNumber } from 'ethers'

import { PoolHedgerParams } from '../admin'
import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import { LyraContractMap, LyraMarketContractMap } from '../constants/mappings'
import { GMXAdapter } from '../contracts/newport/typechain/NewportGMXAdapter'
import { GMXFuturesPoolHedger } from '../contracts/newport/typechain/NewportGMXFuturesPoolHedger'
import { OptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'
import Lyra, { Version } from '../lyra'
import fetchMarketAddresses from './fetchMarketAddresses'
import getLyraContract from './getLyraContract'
import getLyraMarketContract from './getLyraMarketContract'
import multicall, { MulticallRequest } from './multicall'

type RequestGlobalOwner = MulticallRequest<LyraContractMap<any, LyraContractId.ExchangeAdapter>, 'owner'>
type RequestGetHedgerState = MulticallRequest<
  LyraMarketContractMap<Version.Newport, LyraMarketContractId.PoolHedger>,
  'getHedgerState'
>
type RequestGetPoolHedgerParams = MulticallRequest<
  LyraMarketContractMap<Version.Newport, LyraMarketContractId.PoolHedger>,
  'getPoolHedgerParams'
>
type RequestGetAdapterState = MulticallRequest<
  LyraContractMap<Version.Newport, LyraContractId.ExchangeAdapter>,
  'getAdapterState'
>
type RequestGetTokenPrice = MulticallRequest<
  LyraMarketContractMap<Version.Newport, LyraMarketContractId.LiquidityPool>,
  'getTokenPrice'
>

export default async function fetchNewportMarketViews(lyra: Lyra): Promise<{
  marketViews: {
    marketView: OptionMarketViewer.MarketViewStructOutput
    hedgerView: GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput
    adapterView: GMXAdapter.GMXAdapterStateStructOutput
    poolHedgerParams: PoolHedgerParams
    tokenPrice: BigNumber
  }[]
  isGlobalPaused: boolean
  owner: string
  blockNumber: number
}> {
  const viewerContract = getLyraContract(lyra, Version.Newport, LyraContractId.OptionMarketViewer)
  const exchangeAdapterContract = getLyraContract(lyra, Version.Newport, LyraContractId.ExchangeAdapter)
  const globalOwnerReq: RequestGlobalOwner = {
    contract: exchangeAdapterContract,
    function: 'owner',
    args: [],
  }

  const allMarketAddresses = await fetchMarketAddresses(lyra)
  const hedgerRequests: RequestGetHedgerState[] = allMarketAddresses.map(marketAddresses => {
    const poolHedger = getLyraMarketContract(lyra, marketAddresses, Version.Newport, LyraMarketContractId.PoolHedger)
    return {
      contract: poolHedger,
      function: 'getHedgerState',
      args: [],
    }
  })
  const adapterRequests: RequestGetAdapterState[] = allMarketAddresses.map(marketAddresses => {
    return {
      contract: exchangeAdapterContract,
      function: 'getAdapterState',
      args: [marketAddresses.optionMarket],
    }
  })
  const hedgerParamsRequests: RequestGetPoolHedgerParams[] = allMarketAddresses.map(marketAddresses => {
    const poolHedger = getLyraMarketContract(lyra, marketAddresses, Version.Newport, LyraMarketContractId.PoolHedger)
    return {
      contract: poolHedger,
      function: 'getPoolHedgerParams',
      args: [],
    }
  })

  const tokenPriceRequests: RequestGetTokenPrice[] = allMarketAddresses.map(marketAddresses => {
    const liquidityPool = getLyraMarketContract(
      lyra,
      marketAddresses,
      Version.Newport,
      LyraMarketContractId.LiquidityPool
    )
    return {
      contract: liquidityPool,
      function: 'getTokenPrice',
      args: [],
    }
  })

  const {
    returnData: [owner, marketViewsRes, ...hedgerAndAdapterViews],
    blockNumber,
  } = await multicall<
    [
      RequestGlobalOwner,
      MulticallRequest<LyraContractMap<Version.Newport, LyraContractId.OptionMarketViewer>, 'getMarkets'>,
      ...Array<RequestGetAdapterState | RequestGetHedgerState | RequestGetPoolHedgerParams | RequestGetTokenPrice>
    ]
  >(lyra, [
    globalOwnerReq,
    {
      contract: viewerContract,
      function: 'getMarkets',
      args: [allMarketAddresses.map(a => a.optionMarket)],
    },
    ...hedgerRequests,
    ...adapterRequests,
    ...hedgerParamsRequests,
    ...tokenPriceRequests,
  ])

  const hedgerViews: GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput[] = hedgerAndAdapterViews.slice(
    0,
    allMarketAddresses.length
  )
  const adapterViews: GMXAdapter.GMXAdapterStateStructOutput[] = hedgerAndAdapterViews.slice(
    allMarketAddresses.length,
    allMarketAddresses.length * 2
  )
  const poolHedgerParams: PoolHedgerParams[] = hedgerAndAdapterViews.slice(
    allMarketAddresses.length * 2,
    allMarketAddresses.length * 3
  )
  const tokenPrices: BigNumber[] = hedgerAndAdapterViews.slice(
    allMarketAddresses.length * 3,
    allMarketAddresses.length * 4
  )
  const { isPaused, markets } = marketViewsRes
  const marketViews = markets.map((marketView, i) => {
    return {
      marketView,
      hedgerView: hedgerViews[i],
      adapterView: adapterViews[i],
      poolHedgerParams: poolHedgerParams[i],
      tokenPrice: tokenPrices[i],
    }
  })

  return { marketViews, isGlobalPaused: isPaused, owner, blockNumber }
}
