import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import Lyra, { MarketContractAddresses, Version } from '..'
import { LyraContractId, LyraGlobalContractId, LyraMarketContractId } from '../constants/contracts'
import { LyraContractMap, LyraMarketContractMap } from '../constants/mappings'
import { OptionGreekCache } from '../contracts/newport/typechain/NewportOptionGreekCache'
import buildTx from '../utils/buildTx'
import fetchGlobalOwner from '../utils/fetchGlobalOwner'
import getGlobalContract from '../utils/getGlobalContract'
import getLyraContract from '../utils/getLyraContract'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import getLyraMarketContractForAddress from '../utils/getLyraMarketContractForAddress'

export type AdminMarketGlobalCache = {
  minUpdatedAt: BigNumber
  minUpdatedAtPrice: BigNumber
  maxUpdatedAtPrice: BigNumber
  maxSkewVariance: BigNumber
  maxIvVariance: BigNumber
  netGreeks: OptionGreekCache.NetGreeksStruct
  isGlobalCacheStale: boolean
}

export type AdminAvalonGreekCacheParams = {
  maxStrikesPerBoard: BigNumber
  acceptableSpotPricePercentMove: BigNumber
  staleUpdateDuration: BigNumber
  varianceIvGWAVPeriod: BigNumber
  varianceSkewGWAVPeriod: BigNumber
  optionValueIvGWAVPeriod: BigNumber
  optionValueSkewGWAVPeriod: BigNumber
  gwavSkewFloor: BigNumber
  gwavSkewCap: BigNumber
  rateAndCarry: BigNumber
}

export type AdminNewportGreekCacheParams = {
  maxStrikesPerBoard: BigNumber
  acceptableSpotPricePercentMove: BigNumber
  staleUpdateDuration: BigNumber
  varianceIvGWAVPeriod: BigNumber
  varianceSkewGWAVPeriod: BigNumber
  optionValueIvGWAVPeriod: BigNumber
  optionValueSkewGWAVPeriod: BigNumber
  gwavSkewFloor: BigNumber
  gwavSkewCap: BigNumber
}

export type AdminGreekCacheParams<V extends Version> = V extends Version.Avalon
  ? AdminAvalonGreekCacheParams
  : V extends Version.Newport
  ? AdminNewportGreekCacheParams
  : never

export type AdminSetMarketParamsReturn<T> = {
  params: T
  tx: PopulatedTransaction
}

export type AdminForceCloseParams = {
  ivGWAVPeriod: BigNumber
  skewGWAVPeriod: BigNumber
  shortVolShock: BigNumber
  shortPostCutoffVolShock: BigNumber
  longVolShock: BigNumber
  longPostCutoffVolShock: BigNumber
  liquidateVolShock: BigNumber
  liquidatePostCutoffVolShock: BigNumber
  shortSpotMin: BigNumber
  liquidateSpotMin: BigNumber
}

export type AdminMinCollateralParams = {
  minStaticQuoteCollateral: BigNumber
  minStaticBaseCollateral: BigNumber
  shockVolA: BigNumber
  shockVolPointA: BigNumber
  shockVolB: BigNumber
  shockVolPointB: BigNumber
  callSpotPriceShock: BigNumber
  putSpotPriceShock: BigNumber
}

export type AdminOptionMarketParams = {
  maxBoardExpiry: BigNumber
  securityModule: string
  feePortionReserved: BigNumber
  staticBaseSettlementFee: BigNumber
}

export type AdminLiquidityPoolParams<V extends Version> = V extends Version.Avalon
  ? AdminAvalonLiquidityPoolParams
  : V extends Version.Newport
  ? AdminNewportLiquidityPoolParams
  : never

export type AdminNewportLiquidityPoolParams = {
  minDepositWithdraw: BigNumber
  depositDelay: BigNumber
  withdrawalDelay: BigNumber
  withdrawalFee: BigNumber
  guardianMultisig: string
  guardianDelay: BigNumber
  adjustmentNetScalingFactor: BigNumber
  callCollatScalingFactor: BigNumber
  putCollatScalingFactor: BigNumber
}

export type AdminAvalonLiquidityPoolParams = {
  minDepositWithdraw: BigNumber
  depositDelay: BigNumber
  withdrawalDelay: BigNumber
  withdrawalFee: BigNumber
  liquidityCBThreshold: BigNumber
  liquidityCBTimeout: BigNumber
  ivVarianceCBThreshold: BigNumber
  skewVarianceCBThreshold: BigNumber
  ivVarianceCBTimeout: BigNumber
  skewVarianceCBTimeout: BigNumber
  guardianMultisig: string
  guardianDelay: BigNumber
  boardSettlementCBTimeout: BigNumber
  maxFeePaid: BigNumber
}

export type AdminPricingParams = {
  optionPriceFeeCoefficient: BigNumber
  optionPriceFee1xPoint: BigNumber
  optionPriceFee2xPoint: BigNumber
  spotPriceFeeCoefficient: BigNumber
  spotPriceFee1xPoint: BigNumber
  spotPriceFee2xPoint: BigNumber
  vegaFeeCoefficient: BigNumber
  standardSize: BigNumber
  skewAdjustmentFactor: BigNumber
}

export type AdminTradeLimitParams = {
  minDelta: BigNumber
  minForceCloseDelta: BigNumber
  tradingCutoff: BigNumber
  minBaseIV: BigNumber
  maxBaseIV: BigNumber
  minSkew: BigNumber
  maxSkew: BigNumber
  minVol: BigNumber
  maxVol: BigNumber
  absMinSkew: BigNumber
  absMaxSkew: BigNumber
  capSkewsToAbs: boolean
}

export type AdminVarianceFeeParams = {
  defaultVarianceFeeCoefficient: BigNumber
  forceCloseVarianceFeeCoefficient: BigNumber
  skewAdjustmentCoefficient: BigNumber
  referenceSkew: BigNumber
  minimumStaticSkewAdjustment: BigNumber
  vegaCoefficient: BigNumber
  minimumStaticVega: BigNumber
  ivVarianceCoefficient: BigNumber
  minimumStaticIvVariance: BigNumber
}

export type AdminPartialCollatParams = {
  penaltyRatio: BigNumber
  liquidatorFeeRatio: BigNumber
  smFeeRatio: BigNumber
  minLiquidationFee: BigNumber
}

export type AdminPoolHedgerParams = {
  interactionDelay: BigNumber
  hedgeCap: BigNumber
}

export type AdminBoardParams = {
  expiry: BigNumber
  baseIV: BigNumber
  strikePrices: BigNumber[]
  skews: BigNumber[]
  frozen: boolean
}

export type AdminAddBoardReturn = {
  tx: PopulatedTransaction
  board: AdminBoardParams
}

export type AdminStrikeParams = {
  boardId: BigNumber
  strikePrice: BigNumber
  skew: BigNumber
}

export type AdminAddStrikeReturn = {
  tx: PopulatedTransaction
  strike: AdminStrikeParams
}

export type PoolHedgerParams = {
  interactionDelay: BigNumber
  hedgeCap: BigNumber
}

export type FuturesPoolHedgerParams = {
  acceptableSpotSlippage: BigNumber
  deltaThreshold: BigNumber
  marketDepthBuffer: BigNumber
  targetLeverage: BigNumber
  maxLeverage: BigNumber
  minCancelDelay: BigNumber
  minCollateralUpdate: BigNumber
  vaultLiquidityCheckEnabled: boolean
}

export type AdminAdapterMarketPricingParams = {
  staticSwapFeeEstimate: BigNumber
  gmxUsageThreshold: BigNumber
  priceVarianceCBPercent: BigNumber
  chainlinkStalenessCheck: BigNumber
}

export type AdminCircuitBreakerParams = {
  liquidityCBThreshold: BigNumber
  liquidityCBTimeout: BigNumber
  ivVarianceCBThreshold: BigNumber
  skewVarianceCBThreshold: BigNumber
  ivVarianceCBTimeout: BigNumber
  skewVarianceCBTimeout: BigNumber
  boardSettlementCBTimeout: BigNumber
  contractAdjustmentCBTimeout: BigNumber
}

const GAS_LIMIT = BigNumber.from(10_000_000)

export class Admin {
  lyra: Lyra

  constructor(lyra: Lyra) {
    this.lyra = lyra
  }

  static get(lyra: Lyra): Admin {
    return new Admin(lyra)
  }

  contract<V extends Version, C extends LyraContractId>(version: V, contractId: C): LyraContractMap<V, C> {
    return getLyraContract(this.lyra, version, contractId) as LyraContractMap<V, C>
  }

  marketContract<V extends Version, C extends LyraMarketContractId>(
    marketContractAddresses: MarketContractAddresses,
    version: V,
    contractId: C
  ): LyraMarketContractMap<V, C> {
    return getLyraMarketContract(this.lyra, marketContractAddresses, version, contractId)
  }

  globalContract(contractId: LyraGlobalContractId) {
    return getGlobalContract(this.lyra, contractId)
  }

  getMarketContractForAddress<V extends Version>(
    marketContractAddresses: MarketContractAddresses,
    version: V,
    contractAddress: string
  ) {
    return getLyraMarketContractForAddress(this.lyra, version, marketContractAddresses, contractAddress)
  }

  async owner(): Promise<string> {
    return await fetchGlobalOwner(this.lyra)
  }

  async isMarketPaused(marketAddress: string): Promise<boolean> {
    const exchangeAdapter = this.contract(this.lyra.version, LyraContractId.ExchangeAdapter)
    return await exchangeAdapter.isMarketPaused(marketAddress)
  }

  async isGlobalPaused(): Promise<boolean> {
    const exchangeAdapter = this.contract(this.lyra.version, LyraContractId.ExchangeAdapter)
    return await exchangeAdapter.isGlobalPaused()
  }

  async getMarketGlobalCache(marketAddress: string): Promise<AdminMarketGlobalCache> {
    const market = await this.lyra.market(marketAddress)
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionGreekCache
    )
    const [isGlobalCacheStale, globalCache] = await Promise.all([
      optionGreekCache.isGlobalCacheStale(market.spotPrice),
      optionGreekCache.getGlobalCache(),
    ])
    return { ...globalCache, isGlobalCacheStale }
  }

  async setGlobalPaused(isPaused: boolean): Promise<PopulatedTransaction> {
    const exchangeAdapter = this.contract(this.lyra.version, LyraContractId.ExchangeAdapter)
    const owner = await exchangeAdapter.owner()
    const calldata = exchangeAdapter.interface.encodeFunctionData('setGlobalPaused', [isPaused])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, exchangeAdapter.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async setMarketPaused(marketAddressOrName: string, isPaused: boolean): Promise<PopulatedTransaction> {
    const exchangeAdapter = this.contract(this.lyra.version, LyraContractId.ExchangeAdapter)
    const [owner, market] = await Promise.all([exchangeAdapter.owner(), this.lyra.market(marketAddressOrName)])
    const calldata = exchangeAdapter.interface.encodeFunctionData('setMarketPaused', [market.address, isPaused])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, exchangeAdapter.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async addMarketToViewer(newMarketAddresses: MarketContractAddresses): Promise<PopulatedTransaction> {
    const viewer = this.contract(this.lyra.version, LyraContractId.OptionMarketViewer)
    const owner = await viewer.owner()
    const calldata = viewer.interface.encodeFunctionData('addMarket', [newMarketAddresses])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, viewer.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async addMarketToRegistry(
    newMarketAddresses: MarketContractAddresses & { gwavOracle: string }
  ): Promise<PopulatedTransaction> {
    const registry = this.contract(this.lyra.version, LyraContractId.LyraRegistry)
    const owner = await registry.owner()
    const calldata = registry.interface.encodeFunctionData('addMarket', [newMarketAddresses])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, registry.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async addBoard(
    marketAddressOrName: string,
    expiry: BigNumber,
    baseIV: BigNumber,
    strikePrices: BigNumber[],
    skews: BigNumber[],
    frozen: boolean = false
  ): Promise<AdminAddBoardReturn> {
    const market = await this.lyra.market(marketAddressOrName)
    const owner = await market.owner()
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const calldata = optionMarket.interface.encodeFunctionData('createOptionBoard', [
      expiry,
      baseIV,
      strikePrices,
      skews,
      frozen,
    ])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return { tx, board: { expiry, baseIV, strikePrices, skews, frozen } }
  }

  async addStrikeToBoard(
    marketAddresOrName: string,
    boardId: BigNumber,
    strike: BigNumber,
    skew: BigNumber
  ): Promise<AdminAddStrikeReturn> {
    const market = await this.lyra.market(marketAddresOrName)
    const owner = await market.owner()
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const calldata = optionMarket.interface.encodeFunctionData('addStrikeToBoard', [boardId, strike, skew])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return {
      tx,
      strike: {
        boardId,
        strikePrice: strike,
        skew,
      },
    }
  }

  async setBoardPaused(
    marketAddresOrName: string,
    boardId: BigNumber,
    isPaused: boolean
  ): Promise<PopulatedTransaction> {
    const market = await this.lyra.market(marketAddresOrName)
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const owner = await optionMarket.owner()
    const calldata = optionMarket.interface.encodeFunctionData('setBoardFrozen', [boardId, isPaused])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async setBoardBaseIv(
    marketAddresOrName: string,
    boardId: BigNumber,
    baseIv: BigNumber
  ): Promise<PopulatedTransaction> {
    const market = await this.lyra.market(marketAddresOrName)
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const owner = await optionMarket.owner()
    const calldata = optionMarket.interface.encodeFunctionData('setBoardBaseIv', [boardId, baseIv])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async setStrikeSkew(marketAddresOrName: string, strikeId: BigNumber, skew: BigNumber): Promise<PopulatedTransaction> {
    const market = await this.lyra.market(marketAddresOrName)
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const owner = await optionMarket.owner()
    const calldata = optionMarket.interface.encodeFunctionData('setStrikeSkew', [strikeId, skew])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    return {
      ...tx,
      gasLimit: GAS_LIMIT,
    }
  }

  async setGreekCacheParams<V extends Version>(
    version: V,
    marketAddresOrName: string,
    greekCacheParams: Partial<AdminGreekCacheParams<V>>
  ): Promise<AdminSetMarketParamsReturn<AdminGreekCacheParams<V>>> {
    const market = await this.lyra.market(marketAddresOrName)
    if (version === Version.Avalon) {
      const toGreekCacheParams = {
        ...market.__data.marketParameters.greekCacheParams,
        ...greekCacheParams,
      } as AdminGreekCacheParams<Version.Avalon>
      const optionGreekCache = getLyraMarketContract(
        this.lyra,
        market.contractAddresses,
        Version.Avalon,
        LyraMarketContractId.OptionGreekCache
      )
      const owner = await optionGreekCache.owner()
      const calldata = optionGreekCache.interface.encodeFunctionData('setGreekCacheParameters', [toGreekCacheParams])
      const tx = buildTx(
        this.lyra.provider,
        this.lyra.provider.network.chainId,
        optionGreekCache.address,
        owner,
        calldata
      )
      tx.gasLimit = GAS_LIMIT
      return { params: toGreekCacheParams as AdminGreekCacheParams<V>, tx }
    } else {
      const toGreekCacheParams = {
        ...market.__data.marketParameters.greekCacheParams,
        ...greekCacheParams,
      } as AdminGreekCacheParams<Version.Newport>
      const optionGreekCache = getLyraMarketContract(
        this.lyra,
        market.contractAddresses,
        Version.Newport,
        LyraMarketContractId.OptionGreekCache
      )
      const owner = await optionGreekCache.owner()
      const calldata = optionGreekCache.interface.encodeFunctionData('setGreekCacheParameters', [toGreekCacheParams])
      const tx = buildTx(
        this.lyra.provider,
        this.lyra.provider.network.chainId,
        optionGreekCache.address,
        owner,
        calldata
      )
      tx.gasLimit = GAS_LIMIT
      return { params: toGreekCacheParams as AdminGreekCacheParams<V>, tx }
    }
  }

  async setForceCloseParams(
    marketAddresOrName: string,
    forceCloseParams: Partial<AdminForceCloseParams>
  ): Promise<AdminSetMarketParamsReturn<AdminForceCloseParams>> {
    const market = await this.lyra.market(marketAddresOrName)
    const toForceCloseParams = {
      ...market.__data.marketParameters.forceCloseParams,
      ...forceCloseParams,
    }
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionGreekCache
    )
    const owner = await optionGreekCache.owner()
    const calldata = optionGreekCache.interface.encodeFunctionData('setForceCloseParameters', [toForceCloseParams])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      optionGreekCache.address,
      owner,
      calldata
    )
    tx.gasLimit = GAS_LIMIT
    return { params: toForceCloseParams, tx }
  }

  async setMinCollateralParams(
    marketAddresOrName: string,
    minCollateralParams: Partial<AdminMinCollateralParams>
  ): Promise<AdminSetMarketParamsReturn<AdminMinCollateralParams>> {
    const market = await this.lyra.market(marketAddresOrName)
    const toMinCollateralParams = {
      ...market.__data.marketParameters.minCollatParams,
      ...minCollateralParams,
    }
    const optionGreekCache = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionGreekCache
    )
    const owner = await optionGreekCache.owner()
    const calldata = optionGreekCache.interface.encodeFunctionData('setMinCollateralParameters', [
      toMinCollateralParams,
    ])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      optionGreekCache.address,
      owner,
      calldata
    )
    tx.gasLimit = GAS_LIMIT
    return { params: toMinCollateralParams, tx }
  }

  async setLiquidityPoolParams<V extends Version>(
    version: V,
    marketAddressOrName: string,
    lpParams: Partial<AdminLiquidityPoolParams<V>>
  ): Promise<AdminSetMarketParamsReturn<AdminLiquidityPoolParams<V>>> {
    const market = await this.lyra.market(marketAddressOrName)
    if (version === Version.Avalon) {
      const params = {
        ...market.__data.marketParameters.lpParams,
        ...lpParams,
      } as AdminLiquidityPoolParams<Version.Avalon>
      const liquidityPool = getLyraMarketContract(
        this.lyra,
        market.contractAddresses,
        Version.Avalon,
        LyraMarketContractId.LiquidityPool
      )
      const owner = await liquidityPool.owner()
      const calldata = liquidityPool.interface.encodeFunctionData('setLiquidityPoolParameters', [params])
      const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, liquidityPool.address, owner, calldata)
      tx.gasLimit = GAS_LIMIT
      return { params: params as AdminLiquidityPoolParams<V>, tx }
    } else {
      const params = {
        ...market.__data.marketParameters.lpParams,
        ...lpParams,
      } as AdminLiquidityPoolParams<Version.Newport>
      const liquidityPool = getLyraMarketContract(
        this.lyra,
        market.contractAddresses,
        Version.Newport,
        LyraMarketContractId.LiquidityPool
      )
      const owner = await liquidityPool.owner()
      const calldata = liquidityPool.interface.encodeFunctionData('setLiquidityPoolParameters', [params])
      const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, liquidityPool.address, owner, calldata)
      tx.gasLimit = GAS_LIMIT
      return { params: params as AdminLiquidityPoolParams<V>, tx }
    }
  }

  async setPricingParams(
    marketAddressOrName: string,
    pricingParams: Partial<AdminPricingParams>
  ): Promise<AdminSetMarketParamsReturn<AdminPricingParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const toPricingParams = {
      ...market.__data.marketParameters.pricingParams,
      ...pricingParams,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarketPricer
    )
    const owner = await optionMarketPricer.owner()
    const calldata = optionMarketPricer.interface.encodeFunctionData('setPricingParams', [toPricingParams])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      optionMarketPricer.address,
      owner,
      calldata
    )
    tx.gasLimit = GAS_LIMIT
    return { params: toPricingParams, tx }
  }

  async setTradeLimitParams(
    marketAddressOrName: string,
    tradeLimitParams: Partial<AdminTradeLimitParams>
  ): Promise<AdminSetMarketParamsReturn<AdminTradeLimitParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const toTradeLimitParams = {
      ...market.__data.marketParameters.tradeLimitParams,
      ...tradeLimitParams,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarketPricer
    )
    const owner = await optionMarketPricer.owner()
    const calldata = optionMarketPricer.interface.encodeFunctionData('setTradeLimitParams', [toTradeLimitParams])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      optionMarketPricer.address,
      owner,
      calldata
    )
    tx.gasLimit = GAS_LIMIT
    return { params: toTradeLimitParams, tx }
  }

  async setVarianceFeeParams(
    marketAddressOrName: string,
    params: Partial<AdminVarianceFeeParams>
  ): Promise<AdminSetMarketParamsReturn<AdminVarianceFeeParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const toParams = {
      ...market.__data.marketParameters.varianceFeeParams,
      ...params,
    }
    const optionMarketPricer = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarketPricer
    )
    const owner = await optionMarketPricer.owner()
    const calldata = optionMarketPricer.interface.encodeFunctionData('setVarianceFeeParams', [toParams])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      optionMarketPricer.address,
      owner,
      calldata
    )
    tx.gasLimit = GAS_LIMIT
    return { params: toParams, tx }
  }

  async setPartialCollatParams(
    marketAddressOrName: string,
    params: Partial<AdminPartialCollatParams>
  ): Promise<AdminSetMarketParamsReturn<AdminPartialCollatParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const toParams = {
      ...market.__data.marketParameters.partialCollatParams,
      ...params,
    }
    const optionToken = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionToken
    )
    const owner = await optionToken.owner()
    const calldata = optionToken.interface.encodeFunctionData('setPartialCollateralParams', [toParams])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionToken.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return { params: toParams, tx }
  }

  async setOptionMarketParams(
    marketAddressOrName: string,
    params: Partial<AdminOptionMarketParams>
  ): Promise<AdminSetMarketParamsReturn<AdminOptionMarketParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const toParams = {
      ...market.__data.marketParameters.optionMarketParams,
      ...params,
    }
    const optionMarket = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.OptionMarket
    )
    const owner = await optionMarket.owner()
    const calldata = optionMarket.interface.encodeFunctionData('setOptionMarketParams', [toParams])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, optionMarket.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return { params: toParams, tx }
  }

  async setAdapterMarketPricingParams(marketAddressOrName: string, params: Partial<AdminAdapterMarketPricingParams>) {
    const market = await this.lyra.market(marketAddressOrName)
    if (!market.params.adapterView) {
      throw new Error('Adapter market pricing parameters not supported on this market')
    }
    const toParams = {
      ...market.params.adapterView.marketPricingParams,
      ...params,
    }
    const exchangeAdapter = getLyraContract(this.lyra, Version.Newport, LyraContractId.ExchangeAdapter)
    const owner = await exchangeAdapter.owner()
    const calldata = exchangeAdapter.interface.encodeFunctionData('setMarketPricingParams', [market.address, toParams])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, exchangeAdapter.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return { params: toParams, tx }
  }

  async setPoolHedgerParams(
    marketAddressOrName: string,
    params: Partial<PoolHedgerParams>
  ): Promise<AdminSetMarketParamsReturn<PoolHedgerParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    const poolHedger = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.PoolHedger
    )
    const fromParams = await poolHedger.getPoolHedgerParams()
    const toParams = {
      ...fromParams,
      ...params,
    }
    const owner = await market.owner()
    const calldata = poolHedger.interface.encodeFunctionData('setPoolHedgerParams', [toParams])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, poolHedger.address, owner, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async setFuturesPoolHedgerParams(
    marketAddressOrName: string,
    params: Partial<FuturesPoolHedgerParams>
  ): Promise<AdminSetMarketParamsReturn<FuturesPoolHedgerParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    if (market.lyra.version !== Version.Newport || !market.params.hedgerView) {
      throw new Error('Parameters not supported on version')
    }
    const toParams = {
      ...market.params.hedgerView.futuresPoolHedgerParams,
      ...params,
    }
    const futuresPoolHedger = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.PoolHedger
    )
    const owner = await market.owner()

    const calldata = futuresPoolHedger.interface.encodeFunctionData('setFuturesPoolHedgerParams', [toParams])
    const tx = buildTx(
      this.lyra.provider,
      this.lyra.provider.network.chainId,
      futuresPoolHedger.address,
      owner,
      calldata
    )
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async setCircuitBreakerParams(
    marketAddressOrName: string,
    params: Partial<AdminCircuitBreakerParams>
  ): Promise<AdminSetMarketParamsReturn<AdminCircuitBreakerParams>> {
    const market = await this.lyra.market(marketAddressOrName)
    if (market.lyra.version !== Version.Newport || !('cbParams' in market.__data.marketParameters)) {
      throw new Error('Parameters not supported on version')
    }
    const toParams = {
      ...market.__data.marketParameters.cbParams,
      ...params,
    }
    const liquidityPool = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const owner = await market.owner()

    const calldata = liquidityPool.interface.encodeFunctionData('setCircuitBreakerParameters', [toParams])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, liquidityPool.address, owner, calldata)
    tx.gasLimit = BigNumber.from(10_000_000)
    return { params: toParams, tx }
  }

  async processDepositQueue(marketAddressOrName: string, limit: number): Promise<PopulatedTransaction> {
    const market = await this.lyra.market(marketAddressOrName)
    const liquidityPool = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const owner = await liquidityPool.owner()
    const calldata = liquidityPool.interface.encodeFunctionData('processDepositQueue', [limit])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, liquidityPool.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return tx
  }

  async processWithdrawalQueue(marketAddressOrName: string, limit: number): Promise<PopulatedTransaction> {
    const market = await this.lyra.market(marketAddressOrName)
    const liquidityPool = getLyraMarketContract(
      this.lyra,
      market.contractAddresses,
      this.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const owner = await liquidityPool.owner()
    const calldata = liquidityPool.interface.encodeFunctionData('processWithdrawalQueue', [limit])
    const tx = buildTx(this.lyra.provider, this.lyra.provider.network.chainId, liquidityPool.address, owner, calldata)
    tx.gasLimit = GAS_LIMIT
    return tx
  }
}
