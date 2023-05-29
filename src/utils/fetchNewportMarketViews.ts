import { BigNumber } from 'ethers'

import { PoolHedgerParams } from '../admin'
import { ZERO_ADDRESS, ZERO_BN } from '../constants/bn'
import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import { LyraContractMap, LyraMarketContractMap } from '../constants/mappings'
import { GMXAdapter } from '../contracts/newport/typechain/NewportGMXAdapter'
import { GMXFuturesPoolHedger } from '../contracts/newport/typechain/NewportGMXFuturesPoolHedger'
import { OptionMarketViewer } from '../contracts/newport/typechain/NewportOptionMarketViewer'
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

const TESTNET_HEDGER_VIEW: GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStruct = {
  currentPositions: {
    longPosition: {
      size: ZERO_BN,
      collateral: ZERO_BN,
      averagePrice: ZERO_BN,
      entryFundingRate: ZERO_BN,
      unrealisedPnl: ZERO_BN,
      lastIncreasedTime: ZERO_BN,
      isLong: true,
    },
    shortPosition: {
      size: ZERO_BN,
      collateral: ZERO_BN,
      averagePrice: ZERO_BN,
      entryFundingRate: ZERO_BN,
      unrealisedPnl: ZERO_BN,
      lastIncreasedTime: ZERO_BN,
      isLong: false,
    },
    amountOpen: ZERO_BN,
    isLong: true,
  },
  futuresPoolHedgerParams: {
    acceptableSpotSlippage: ZERO_BN,
    deltaThreshold: ZERO_BN,
    marketDepthBuffer: ZERO_BN,
    targetLeverage: ZERO_BN,
    maxLeverage: ZERO_BN,
    minCancelDelay: ZERO_BN,
    minCollateralUpdate: ZERO_BN,
    vaultLiquidityCheckEnabled: false,
  },
  hedgerAddresses: {
    router: ZERO_ADDRESS,
    positionRouter: ZERO_ADDRESS,
    vault: ZERO_ADDRESS,
    quoteAsset: ZERO_ADDRESS,
    baseAsset: ZERO_ADDRESS,
    weth: ZERO_ADDRESS,
  },
  gmxView: {
    basePoolAmount: ZERO_BN,
    baseReservedAmount: ZERO_BN,
    quotePoolAmount: ZERO_BN,
    quoteReservedAmount: ZERO_BN,
    maxGlobalLongSize: ZERO_BN,
    guaranteedUSD: ZERO_BN,
    maxGlobalShortSize: ZERO_BN,
    shortSize: ZERO_BN,
    minExecutionFee: ZERO_BN,
    remainingLongDollars: ZERO_BN,
    remainingShortDollars: ZERO_BN,
  },
  referralCode: '',
  pendingOrderKey: '',
  lastOrderTimestamp: ZERO_BN,
  spotPrice: ZERO_BN,
  expectedHedge: ZERO_BN,
  currentHedge: ZERO_BN,
  currentLeverage: ZERO_BN,
  pendingCollateralDelta: ZERO_BN,
  baseBal: ZERO_BN,
  quoteBal: ZERO_BN,
  wethBal: ZERO_BN,
}

const TESTNET_POOL_HEDGER_PARAMS: PoolHedgerParams = {
  interactionDelay: ZERO_BN,
  hedgeCap: ZERO_BN,
}

export default async function fetchNewportMarketViews(lyra: Lyra): Promise<{
  marketViews: {
    marketView: OptionMarketViewer.MarketViewStructOutput
    hedgerView: GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput
    adapterView: GMXAdapter.GMXAdapterStateStructOutput
    poolHedgerParams: PoolHedgerParams
    tokenPrice: BigNumber
    baseLimit: null
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
  const adapterRequests: RequestGetAdapterState[] = allMarketAddresses.map(marketAddresses => {
    return {
      contract: exchangeAdapterContract,
      function: 'getAdapterState',
      args: [marketAddresses.optionMarket],
    }
  })
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
    hedgerRequests.length
  )
  const adapterViews: GMXAdapter.GMXAdapterStateStructOutput[] = hedgerAndAdapterViews.slice(
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
          (TESTNET_HEDGER_VIEW as GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput),
      adapterView: adapterViews[i],
      poolHedgerParams: !isTestnet(lyra) ? poolHedgerParams[i] : TESTNET_POOL_HEDGER_PARAMS,
      tokenPrice: tokenPrices[i],
      baseLimit: null,
    }
  })

  return { marketViews, isGlobalPaused: isPaused, owner, blockNumber }
}
