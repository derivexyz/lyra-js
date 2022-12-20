import {
  LiquidityPool as LiquidityPoolAvalon,
  OptionGreekCache as OptionGreekCacheAvalon,
  OptionMarket as OptionMarketAvalon,
  OptionMarketPricer as OptionMarketPricerAvalon,
  OptionMarketViewer as OptionMarketViewerAvalon,
  OptionToken as OptionTokenAvalon,
  ShortCollateral as ShortCollateralAvalon,
  ShortPoolHedger as ShortPoolHedgerAvalon,
  SynthetixAdapter as SynthetixAdapterAvalon,
} from '../contracts/avalon/typechain'
import {
  ArrakisPool,
  ExchangeAdapter,
  LiquidityToken,
  LyraRegistry,
  LyraStakingModule,
  Multicall3,
  MultiDistributor,
  StakingRewards,
  TestFaucet,
} from '../contracts/common/typechain'
import {
  LiquidityPool,
  OptionGreekCache,
  OptionMarket,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionMarketWrapper,
  OptionToken,
  PoolHedger,
  ShortCollateral,
} from '../contracts/newport/typechain'
import { LyraContractId, LyraMarketContractId } from './contracts'

export type LyraContractReturnType = {
  [LyraContractId.OptionMarketViewer]: OptionMarketViewer
  [LyraContractId.OptionMarketWrapper]: OptionMarketWrapper
  [LyraContractId.TestFaucet]: TestFaucet
  [LyraContractId.ExchangeAdapter]: ExchangeAdapter
  [LyraContractId.LyraStakingModuleProxy]: LyraStakingModule
  [LyraContractId.MultiDistributor]: MultiDistributor
  [LyraContractId.LyraRegistry]: LyraRegistry
  [LyraContractId.ArrakisPool]: ArrakisPool
  [LyraContractId.WethLyraStakingRewards]: StakingRewards
  [LyraContractId.SynthetixAdapter]: SynthetixAdapterAvalon
  [LyraContractId.Multicall3]: Multicall3
}

export type LyraMarketContractReturnType = {
  [LyraMarketContractId.OptionMarket]: OptionMarket
  [LyraMarketContractId.OptionMarketPricer]: OptionMarketPricer
  [LyraMarketContractId.OptionToken]: OptionToken
  [LyraMarketContractId.ShortCollateral]: ShortCollateral
  [LyraMarketContractId.OptionGreekCache]: OptionGreekCache
  [LyraMarketContractId.LiquidityToken]: LiquidityToken
  [LyraMarketContractId.LiquidityPool]: LiquidityPool
  // TODO @michaelxuwu fix PoolHedger return type
  [LyraMarketContractId.PoolHedger]: PoolHedger
}

/* Avalon Types */
export type LyraAvalonContractReturnType = {
  [LyraContractId.OptionMarketViewer]: OptionMarketViewerAvalon
  [LyraContractId.OptionMarketWrapper]: OptionMarketWrapper
  [LyraContractId.TestFaucet]: TestFaucet
  [LyraContractId.SynthetixAdapter]: SynthetixAdapterAvalon
  [LyraContractId.ExchangeAdapter]: ExchangeAdapter
  [LyraContractId.LyraStakingModuleProxy]: LyraStakingModule
  [LyraContractId.MultiDistributor]: MultiDistributor
  [LyraContractId.LyraRegistry]: LyraRegistry
  [LyraContractId.ArrakisPool]: ArrakisPool
  [LyraContractId.WethLyraStakingRewards]: StakingRewards
  [LyraContractId.Multicall3]: Multicall3
}

export type LyraMarketAvalonContractReturnType = {
  [LyraMarketContractId.OptionMarket]: OptionMarketAvalon
  [LyraMarketContractId.OptionMarketPricer]: OptionMarketPricerAvalon
  [LyraMarketContractId.OptionToken]: OptionTokenAvalon
  [LyraMarketContractId.ShortCollateral]: ShortCollateralAvalon
  [LyraMarketContractId.OptionGreekCache]: OptionGreekCacheAvalon
  [LyraMarketContractId.LiquidityToken]: LiquidityToken
  [LyraMarketContractId.LiquidityPool]: LiquidityPoolAvalon
  [LyraMarketContractId.PoolHedger]: ShortPoolHedgerAvalon
}
