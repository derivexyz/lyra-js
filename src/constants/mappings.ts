import {
  AvalonLiquidityPool,
  AvalonLiquidityToken,
  AvalonLyraRegistry,
  AvalonOptionGreekCache,
  AvalonOptionMarket,
  AvalonOptionMarketPricer,
  AvalonOptionMarketViewer,
  AvalonOptionToken,
  AvalonShortCollateral,
  AvalonShortPoolHedger,
  AvalonSynthetixAdapter,
  AvalonTestFaucet,
} from '../contracts/avalon/typechain'
import { Multicall3, MultiDistributor } from '../contracts/common/typechain'
import { NewportOptionMarket as NewportArbitrumOptionMarket } from '../contracts/newport/arbitrum/typechain'
import { NewportOptionMarket as NewportOptimismOptionMarket } from '../contracts/newport/optimism/typechain'
import {
  NewportGMXAdapter,
  NewportGMXFuturesPoolHedger,
  NewportLiquidityPool,
  NewportLiquidityToken,
  NewportLyraRegistry,
  NewportOptionGreekCache,
  NewportOptionMarketPricer,
  NewportOptionMarketViewer,
  NewportOptionToken,
  NewportShortCollateral,
  NewportSNXPerpsV2PoolHedger,
  NewportSNXPerpV2Adapter,
  NewportTestFaucet,
} from '../contracts/newport/typechain'
import { Version } from '../lyra'
import { LyraContractId, LyraGlobalContractId, LyraMarketContractId } from './contracts'

export type LyraNewportContractMap = {
  [LyraContractId.OptionMarketViewer]: NewportOptionMarketViewer
  [LyraContractId.TestFaucet]: NewportTestFaucet
  [LyraContractId.ExchangeAdapter]: NewportGMXAdapter | NewportSNXPerpV2Adapter
  [LyraContractId.LyraRegistry]: NewportLyraRegistry
}

export type LyraAvalonContractMap = {
  [LyraContractId.OptionMarketViewer]: AvalonOptionMarketViewer
  [LyraContractId.TestFaucet]: AvalonTestFaucet
  [LyraContractId.ExchangeAdapter]: AvalonSynthetixAdapter
  [LyraContractId.LyraRegistry]: AvalonLyraRegistry
}

export type LyraContractMap<V extends Version, C extends LyraContractId> = V extends Version.Avalon
  ? LyraAvalonContractMap[C]
  : V extends Version.Newport
  ? LyraNewportContractMap[C]
  : never

export type LyraMarketAvalonContractMap = {
  [LyraMarketContractId.OptionMarket]: AvalonOptionMarket
  [LyraMarketContractId.OptionMarketPricer]: AvalonOptionMarketPricer
  [LyraMarketContractId.OptionToken]: AvalonOptionToken
  [LyraMarketContractId.ShortCollateral]: AvalonShortCollateral
  [LyraMarketContractId.OptionGreekCache]: AvalonOptionGreekCache
  [LyraMarketContractId.LiquidityToken]: AvalonLiquidityToken
  [LyraMarketContractId.LiquidityPool]: AvalonLiquidityPool
  [LyraMarketContractId.PoolHedger]: AvalonShortPoolHedger
}

export type LyraMarketNewportContractMap = {
  [LyraMarketContractId.OptionMarket]: NewportArbitrumOptionMarket | NewportOptimismOptionMarket
  [LyraMarketContractId.OptionMarketPricer]: NewportOptionMarketPricer
  [LyraMarketContractId.OptionToken]: NewportOptionToken
  [LyraMarketContractId.ShortCollateral]: NewportShortCollateral
  [LyraMarketContractId.OptionGreekCache]: NewportOptionGreekCache
  [LyraMarketContractId.LiquidityToken]: NewportLiquidityToken
  [LyraMarketContractId.LiquidityPool]: NewportLiquidityPool
  [LyraMarketContractId.PoolHedger]: NewportGMXFuturesPoolHedger | NewportSNXPerpsV2PoolHedger
}

export type LyraMarketContractMap<V extends Version, C extends LyraMarketContractId> = V extends Version.Avalon
  ? LyraMarketAvalonContractMap[C]
  : V extends Version.Newport
  ? LyraMarketNewportContractMap[C]
  : never

export type LyraGlobalContractMap = {
  [LyraGlobalContractId.MultiDistributor]: MultiDistributor
  [LyraGlobalContractId.Multicall3]: Multicall3
}
