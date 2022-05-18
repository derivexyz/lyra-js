import { ContractInterface } from '@ethersproject/contracts'

import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import LIQUIDITY_POOL_ABI from '../contracts/abis/LiquidityPool.json'
import LIQUIDITY_TOKENS_ABI from '../contracts/abis/LiquidityTokens.json'
import OPTION_GREEK_CACHE_ABI from '../contracts/abis/OptionGreekCache.json'
import OPTION_MARKET_ABI from '../contracts/abis/OptionMarket.json'
import OPTION_MARKET_PRICER_ABI from '../contracts/abis/OptionMarketPricer.json'
import OPTION_MARKET_VIEWER_ABI from '../contracts/abis/OptionMarketViewer.json'
import OPTION_MARKET_WRAPPER_ABI from '../contracts/abis/OptionMarketWrapper.json'
import OPTION_TOKEN_ABI from '../contracts/abis/OptionToken.json'
import POOL_HEDGER_ABI from '../contracts/abis/PoolHedger.json'
import SHORT_COLLATERAL_ABI from '../contracts/abis/ShortCollateral.json'
import SYNTHETIX_ADAPTER_ABI from '../contracts/abis/SynthetixAdapter.json'
import TEST_FAUCET_ABI from '../contracts/abis/TestFaucet.json'

export default function getLyraContractABI(contractId: LyraContractId | LyraMarketContractId): ContractInterface {
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
      return OPTION_MARKET_VIEWER_ABI
    case LyraContractId.OptionMarketWrapper:
      return OPTION_MARKET_WRAPPER_ABI
    case LyraContractId.TestFaucet:
      return TEST_FAUCET_ABI
    case LyraContractId.SynthetixAdapter:
      return SYNTHETIX_ADAPTER_ABI
    case LyraMarketContractId.LiquidityPool:
      return LIQUIDITY_POOL_ABI
    case LyraMarketContractId.LiquidityTokens:
      return LIQUIDITY_TOKENS_ABI
    case LyraMarketContractId.OptionGreekCache:
      return OPTION_GREEK_CACHE_ABI
    case LyraMarketContractId.OptionMarket:
      return OPTION_MARKET_ABI
    case LyraMarketContractId.OptionToken:
      return OPTION_TOKEN_ABI
    case LyraMarketContractId.ShortCollateral:
      return SHORT_COLLATERAL_ABI
    case LyraMarketContractId.OptionMarketPricer:
      return OPTION_MARKET_PRICER_ABI
    case LyraMarketContractId.PoolHedger:
      return POOL_HEDGER_ABI
  }
}
