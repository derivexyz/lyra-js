import { BigNumber } from 'ethers'

import { PoolHedgerParams } from '../admin'
import { MAX_BN, ZERO_BN } from '../constants/bn'
import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import { LyraContractMap, LyraMarketContractMap } from '../constants/mappings'
import { NewportOptionMarket } from '../contracts/newport/optimism/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'
import { SNXPerpsV2PoolHedger } from '../contracts/newport/typechain/NewportSNXPerpsV2PoolHedger'
import { SNXPerpV2Adapter } from '../contracts/newport/typechain/NewportSNXPerpV2Adapter'
import Lyra, { Version } from '../lyra'
import fetchMarketAddresses from './fetchMarketAddresses'
import getLyraContract from './getLyraContract'
import getLyraMarketContract from './getLyraMarketContract'
import isTestnet from './isTestnet'
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
type RequestGetBaseLimit = MulticallRequest<NewportOptionMarket, 'baseLimit'>

const TESTNET_POOL_HEDGER_PARAMS: PoolHedgerParams = {
  interactionDelay: ZERO_BN,
  hedgeCap: ZERO_BN,
}

const TESTNET_HEDGER_VIEW: SNXPerpsV2PoolHedger.HedgerStateStruct = {
  lastInteraction: ZERO_BN,
  hedgedDelta: ZERO_BN,
  margin: ZERO_BN,
  leverage: ZERO_BN,
  hedgerQuoteBalance: ZERO_BN,
  hedgerMarginQuoteBalance: ZERO_BN,
  canHedgeDeltaIncrease: true,
  canHedgeDeltaDecrease: true,
  cappedExpectedHedge: ZERO_BN,
  snxHasEnoughMarketDepth: true,
  marketSuspended: false,
  curveRateStable: true,
  pendingDeltaLiquidity: ZERO_BN,
  usedDeltaLiquidity: ZERO_BN,
  pendingDelta: ZERO_BN,
  pendingMargin: ZERO_BN,
  fundingRate: ZERO_BN,
  trackingCode: '',
  optionMarket: '',
  perpsMarket: '',
  curveSwap: '',
  quoteAsset: '',
  futuresPoolHedgerParams: {
    targetLeverage: ZERO_BN,
    maximumFundingRate: ZERO_BN,
    deltaThreshold: ZERO_BN,
    marketDepthBuffer: ZERO_BN,
    priceDeltaBuffer: ZERO_BN,
    worstStableRate: ZERO_BN,
    maxOrderCap: ZERO_BN,
  },
  poolHedgerParams: {
    interactionDelay: ZERO_BN,
    hedgeCap: ZERO_BN,
  },
  longInterest: ZERO_BN,
  shortInterest: ZERO_BN,
  maxTotalMarketSize: MAX_BN,
}

export default async function fetchNewportOptimismMarketViews(lyra: Lyra): Promise<{
  marketViews: {
    marketView: OptionMarketViewer.MarketViewStructOutput
    hedgerView: SNXPerpsV2PoolHedger.HedgerStateStructOutput
    adapterView: SNXPerpV2Adapter.MarketAdapterStateStructOutput
    poolHedgerParams: PoolHedgerParams
    tokenPrice: BigNumber
    baseLimit: BigNumber
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
  const hedgerRequests: RequestGetHedgerState[] = !isTestnet(lyra)
    ? allMarketAddresses.map(marketAddresses => {
        const poolHedger = getLyraMarketContract(
          lyra,
          marketAddresses,
          Version.Newport,
          LyraMarketContractId.PoolHedger
        )
        return {
          contract: poolHedger,
          function: 'getHedgerState',
          args: [],
        }
      })
    : []

  const adapterRequests: RequestGetAdapterState[] = !isTestnet(lyra)
    ? allMarketAddresses.map(marketAddresses => {
        return {
          contract: exchangeAdapterContract,
          function: 'getAdapterState',
          args: [marketAddresses.optionMarket],
        }
      })
    : []

  const hedgerParamsRequests: RequestGetPoolHedgerParams[] = !isTestnet(lyra)
    ? allMarketAddresses.map(marketAddresses => {
        const poolHedger = getLyraMarketContract(
          lyra,
          marketAddresses,
          Version.Newport,
          LyraMarketContractId.PoolHedger
        )
        return {
          contract: poolHedger,
          function: 'getPoolHedgerParams',
          args: [],
        }
      })
    : []

  const tokenPriceRequests: RequestGetTokenPrice[] = !isTestnet(lyra)
    ? allMarketAddresses.map(marketAddresses => {
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
    : []

  const baseLimitRequests: RequestGetBaseLimit[] = allMarketAddresses.map(marketAddresses => {
    const optionMarket = getLyraMarketContract(
      lyra,
      marketAddresses,
      Version.Newport,
      LyraMarketContractId.OptionMarket
    ) as NewportOptionMarket
    return {
      contract: optionMarket,
      function: 'baseLimit',
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

  const { returnData: baseLimits } = await multicall<RequestGetBaseLimit[]>(lyra, baseLimitRequests)

  const hedgerViews: SNXPerpsV2PoolHedger.HedgerStateStructOutput[] = hedgerAndAdapterViews.slice(
    0,
    hedgerRequests.length
  )
  const adapterViews: SNXPerpV2Adapter.MarketAdapterStateStructOutput[] = hedgerAndAdapterViews.slice(
    hedgerRequests.length,
    hedgerRequests.length + adapterRequests.length
  )
  const poolHedgerParams: PoolHedgerParams[] = hedgerAndAdapterViews.slice(
    hedgerRequests.length + adapterRequests.length,
    hedgerRequests.length + adapterRequests.length + hedgerParamsRequests.length
  )
  const tokenPrices: BigNumber[] = hedgerAndAdapterViews.slice(
    hedgerRequests.length + adapterRequests.length + hedgerParamsRequests.length
  )

  const { isPaused, markets } = marketViewsRes
  const marketViews = markets.map((marketView, i) => {
    return {
      marketView,
      hedgerView: !isTestnet(lyra)
        ? hedgerViews[i]
        : // HACK: Cast ViewStruct to ViewStructOutput
          (TESTNET_HEDGER_VIEW as SNXPerpsV2PoolHedger.HedgerStateStructOutput),
      adapterView: adapterViews[i],
      poolHedgerParams: !isTestnet(lyra) ? poolHedgerParams[i] : TESTNET_POOL_HEDGER_PARAMS,
      tokenPrice: tokenPrices[i],
      baseLimit: baseLimits[i],
    }
  })

  return { marketViews, isGlobalPaused: isPaused, owner, blockNumber }
}
