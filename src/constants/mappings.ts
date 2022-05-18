import {
  LiquidityPool,
  LiquidityTokens,
  OptionGreekCache,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionMarketWrapper,
  OptionToken,
  PoolHedger,
  ShortCollateral,
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
}

export type LyraMarketContractReturnType = {
  [LyraMarketContractId.OptionMarket]: OptionMarket
  [LyraMarketContractId.OptionMarketPricer]: OptionMarketPricer
  [LyraMarketContractId.OptionToken]: OptionToken
  [LyraMarketContractId.ShortCollateral]: ShortCollateral
  [LyraMarketContractId.OptionGreekCache]: OptionGreekCache
  [LyraMarketContractId.LiquidityTokens]: LiquidityTokens
  [LyraMarketContractId.LiquidityPool]: LiquidityPool
  [LyraMarketContractId.PoolHedger]: PoolHedger
}
