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
import { LyraStakingModule, Multicall3, MultiDistributor } from '../contracts/common/typechain'
import {
  NewportGMXAdapter,
  NewportGMXFuturesPoolHedger,
  NewportLiquidityPool,
  NewportLiquidityToken,
  NewportLyraRegistry,
  NewportOptionGreekCache,
  NewportOptionMarket,
  NewportOptionMarketPricer,
  NewportOptionMarketViewer,
  NewportOptionToken,
  NewportShortCollateral,
  NewportTestFaucet,
} from '../contracts/newport/typechain'
import { Version } from '../lyra'
import { LyraContractId, LyraGlobalContractId, LyraMarketContractId } from './contracts'

export type LyraNewportContractMap = {
  [LyraContractId.OptionMarketViewer]: NewportOptionMarketViewer
  [LyraContractId.TestFaucet]: NewportTestFaucet
  [LyraContractId.ExchangeAdapter]: NewportGMXAdapter
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
  [LyraMarketContractId.OptionMarket]: NewportOptionMarket
  [LyraMarketContractId.OptionMarketPricer]: NewportOptionMarketPricer
  [LyraMarketContractId.OptionToken]: NewportOptionToken
  [LyraMarketContractId.ShortCollateral]: NewportShortCollateral
  [LyraMarketContractId.OptionGreekCache]: NewportOptionGreekCache
  [LyraMarketContractId.LiquidityToken]: NewportLiquidityToken
  [LyraMarketContractId.LiquidityPool]: NewportLiquidityPool
  [LyraMarketContractId.PoolHedger]: NewportGMXFuturesPoolHedger
}

export type LyraMarketContractMap<V extends Version, C extends LyraMarketContractId> = V extends Version.Avalon
  ? LyraMarketAvalonContractMap[C]
  : V extends Version.Newport
  ? LyraMarketNewportContractMap[C]
  : never

export type LyraGlobalContractMap = {
  [LyraGlobalContractId.MultiDistributor]: MultiDistributor
  [LyraGlobalContractId.Multicall3]: Multicall3
  [LyraGlobalContractId.LyraStakingModule]: LyraStakingModule
}
