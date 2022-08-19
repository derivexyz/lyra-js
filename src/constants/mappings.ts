import {
  LiquidityPool,
  LiquidityToken,
  LyraRegistry,
  LyraStakingModule,
  MultiDistributor,
  OptionGreekCache,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionMarketWrapper,
  OptionToken,
  ShortCollateral,
  ShortPoolHedger,
  SynthetixAdapter,
  TestFaucet,
} from '../contracts/typechain'
import { OptionMarket } from '../contracts/typechain/OptionMarket'
import { LyraContractId, LyraMarketContractId } from './contracts'

export type LyraContractReturnType = {
  [LyraContractId.OptionMarketViewer]: OptionMarketViewer
  [LyraContractId.OptionMarketWrapper]: OptionMarketWrapper
  [LyraContractId.TestFaucet]: TestFaucet
  [LyraContractId.SynthetixAdapter]: SynthetixAdapter
  [LyraContractId.LyraStakingModuleProxy]: LyraStakingModule
  [LyraContractId.MultiDistributor]: MultiDistributor
  [LyraContractId.LyraRegistry]: LyraRegistry
}

export type LyraMarketContractReturnType = {
  [LyraMarketContractId.OptionMarket]: OptionMarket
  [LyraMarketContractId.OptionMarketPricer]: OptionMarketPricer
  [LyraMarketContractId.OptionToken]: OptionToken
  [LyraMarketContractId.ShortCollateral]: ShortCollateral
  [LyraMarketContractId.OptionGreekCache]: OptionGreekCache
  [LyraMarketContractId.LiquidityToken]: LiquidityToken
  [LyraMarketContractId.LiquidityPool]: LiquidityPool
  [LyraMarketContractId.ShortPoolHedger]: ShortPoolHedger
}
