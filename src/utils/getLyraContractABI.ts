import { ContractInterface } from '@ethersproject/contracts'

import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import ARRAKIS_POOL_ABI from '../contracts/abis/ArrakisPool.json'
import LIQUIDITY_POOL_ABI from '../contracts/abis/LiquidityPool.json'
import LIQUIDITY_TOKEN_ABI from '../contracts/abis/LiquidityToken.json'
import LYRA_REGISTRY_ABI from '../contracts/abis/LyraRegistry.json'
import LYRA_STAKING_MODULE_ABI from '../contracts/abis/LyraStakingModule.json'
import MULTIDISTRIBUTOR_ABI from '../contracts/abis/MultiDistributor.json'
import OPTION_GREEK_CACHE_ABI from '../contracts/abis/OptionGreekCache.json'
import OPTION_MARKET_ABI from '../contracts/abis/OptionMarket.json'
import OPTION_MARKET_PRICER_ABI from '../contracts/abis/OptionMarketPricer.json'
import OPTION_MARKET_VIEWER_ABI from '../contracts/abis/OptionMarketViewer.json'
import OPTION_MARKET_WRAPPER_ABI from '../contracts/abis/OptionMarketWrapper.json'
import OPTION_TOKEN_ABI from '../contracts/abis/OptionToken.json'
import SHORT_COLLATERAL_ABI from '../contracts/abis/ShortCollateral.json'
import SHORT_POOL_HEDGER_ABI from '../contracts/abis/ShortPoolHedger.json'
import STAKING_REWARDS_ABI from '../contracts/abis/StakingRewards.json'
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
    case LyraMarketContractId.LiquidityToken:
      return LIQUIDITY_TOKEN_ABI
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
    case LyraMarketContractId.ShortPoolHedger:
      return SHORT_POOL_HEDGER_ABI
    case LyraContractId.LyraStakingModuleProxy:
      return LYRA_STAKING_MODULE_ABI
    case LyraContractId.LyraRegistry:
      return LYRA_REGISTRY_ABI
    case LyraContractId.MultiDistributor:
      return MULTIDISTRIBUTOR_ABI
    case LyraContractId.ArrakisPool:
      return ARRAKIS_POOL_ABI
    case LyraContractId.WethLyraStakingRewards:
      return STAKING_REWARDS_ABI
  }
}
