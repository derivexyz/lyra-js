import { ContractInterface } from '@ethersproject/contracts'

import { Version } from '..'
import { LyraContractId, LyraMarketContractId } from '../constants/contracts'
import AVALON_LIQUIDITY_POOL_ABI from '../contracts/avalon/abis/LiquidityPool.json'
import AVALON_OPTION_GREEK_CACHE_ABI from '../contracts/avalon/abis/OptionGreekCache.json'
import AVALON_OPTION_MARKET_ABI from '../contracts/avalon/abis/OptionMarket.json'
import AVALON_OPTION_MARKET_PRICER_ABI from '../contracts/avalon/abis/OptionMarketPricer.json'
import AVALON_OPTION_MARKET_VIEWER_ABI from '../contracts/avalon/abis/OptionMarketViewer.json'
import AVALON_OPTION_MARKET_WRAPPER_ABI from '../contracts/avalon/abis/OptionMarketWrapper.json'
import AVALON_OPTION_TOKEN_ABI from '../contracts/avalon/abis/OptionToken.json'
import AVALON_SHORT_COLLATERAL_ABI from '../contracts/avalon/abis/ShortCollateral.json'
import AVALON_SHORT_POOL_HEDGER_ABI from '../contracts/avalon/abis/ShortPoolHedger.json'
import AVALON_SYNTHETIX_ADAPTER_ABI from '../contracts/avalon/abis/SynthetixAdapter.json'
import ARRAKIS_POOL_ABI from '../contracts/common/abis/ArrakisPool.json'
import EXCHANGE_ADAPTER_ABI from '../contracts/common/abis/ExchangeAdapter.json'
import LIQUIDITY_TOKEN_ABI from '../contracts/common/abis/LiquidityToken.json'
import LYRA_REGISTRY_ABI from '../contracts/common/abis/LyraRegistry.json'
import LYRA_STAKING_MODULE_ABI from '../contracts/common/abis/LyraStakingModule.json'
import MULTICALL_3_ABI from '../contracts/common/abis/Multicall3.json'
import MULTIDISTRIBUTOR_ABI from '../contracts/common/abis/MultiDistributor.json'
import STAKING_REWARDS_ABI from '../contracts/common/abis/StakingRewards.json'
import TEST_FAUCET_ABI from '../contracts/common/abis/TestFaucet.json'
import LIQUIDITY_POOL_ABI from '../contracts/newport/abis/LiquidityPool.json'
import NEWPORT_OPTION_GREEK_CACHE_ABI from '../contracts/newport/abis/OptionGreekCache.json'
import NEWPORT_OPTION_MARKET_ABI from '../contracts/newport/abis/OptionMarket.json'
import OPTION_MARKET_PRICER_ABI from '../contracts/newport/abis/OptionMarketPricer.json'
import NEWPORT_OPTION_MARKET_VIEWER_ABI from '../contracts/newport/abis/OptionMarketViewer.json'
import NEWPORT_OPTION_MARKET_WRAPPER_ABI from '../contracts/newport/abis/OptionMarketWrapper.json'
import NEWPORT_OPTION_TOKEN_ABI from '../contracts/newport/abis/OptionToken.json'
import NEWPORT_POOL_HEDGER_ABI from '../contracts/newport/abis/PoolHedger.json'
import SHORT_COLLATERAL_ABI from '../contracts/newport/abis/ShortCollateral.json'

type VersionedContract =
  | LyraContractId.OptionMarketViewer
  | LyraContractId.OptionMarketWrapper
  | LyraMarketContractId.LiquidityPool
  | LyraMarketContractId.OptionGreekCache
  | LyraMarketContractId.OptionMarket
  | LyraMarketContractId.OptionMarketPricer
  | LyraMarketContractId.OptionToken
  | LyraMarketContractId.PoolHedger
  | LyraMarketContractId.ShortCollateral

function getAvalonContractABI(contractId: VersionedContract): ContractInterface {
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
      return AVALON_OPTION_MARKET_VIEWER_ABI
    case LyraContractId.OptionMarketWrapper:
      return AVALON_OPTION_MARKET_WRAPPER_ABI
    case LyraMarketContractId.LiquidityPool:
      return AVALON_LIQUIDITY_POOL_ABI
    case LyraMarketContractId.OptionGreekCache:
      return AVALON_OPTION_GREEK_CACHE_ABI
    case LyraMarketContractId.OptionMarket:
      return AVALON_OPTION_MARKET_ABI
    case LyraMarketContractId.OptionMarketPricer:
      return AVALON_OPTION_MARKET_PRICER_ABI
    case LyraMarketContractId.OptionToken:
      return AVALON_OPTION_TOKEN_ABI
    case LyraMarketContractId.PoolHedger:
      return AVALON_SHORT_POOL_HEDGER_ABI
    case LyraMarketContractId.ShortCollateral:
      return AVALON_SHORT_COLLATERAL_ABI
  }
}
function getNewportContractABI(contractId: VersionedContract): ContractInterface {
  switch (contractId) {
    case LyraContractId.OptionMarketViewer:
      return NEWPORT_OPTION_MARKET_VIEWER_ABI
    case LyraContractId.OptionMarketWrapper:
      return NEWPORT_OPTION_MARKET_WRAPPER_ABI
    case LyraMarketContractId.LiquidityPool:
      return LIQUIDITY_POOL_ABI
    case LyraMarketContractId.OptionGreekCache:
      return NEWPORT_OPTION_GREEK_CACHE_ABI
    case LyraMarketContractId.OptionMarket:
      return NEWPORT_OPTION_MARKET_ABI
    case LyraMarketContractId.OptionMarketPricer:
      return OPTION_MARKET_PRICER_ABI
    case LyraMarketContractId.OptionToken:
      return NEWPORT_OPTION_TOKEN_ABI
    case LyraMarketContractId.PoolHedger:
      return NEWPORT_POOL_HEDGER_ABI
    case LyraMarketContractId.ShortCollateral:
      return SHORT_COLLATERAL_ABI
  }
}

export default function getLyraContractABI(
  version: Version,
  contractId: LyraContractId | LyraMarketContractId
): ContractInterface {
  switch (contractId) {
    // Common contracts
    case LyraContractId.ArrakisPool:
      return ARRAKIS_POOL_ABI
    case LyraContractId.ExchangeAdapter:
      return EXCHANGE_ADAPTER_ABI
    case LyraMarketContractId.LiquidityToken:
      return LIQUIDITY_TOKEN_ABI
    case LyraContractId.MultiDistributor:
      return MULTIDISTRIBUTOR_ABI
    case LyraContractId.LyraStakingModuleProxy:
      return LYRA_STAKING_MODULE_ABI
    case LyraContractId.LyraRegistry:
      return LYRA_REGISTRY_ABI
    case LyraContractId.TestFaucet:
      return TEST_FAUCET_ABI
    case LyraContractId.WethLyraStakingRewards:
      return STAKING_REWARDS_ABI
    // TODO @michaelxuwu deprecate SynthetixAdapter
    case LyraContractId.SynthetixAdapter:
      return AVALON_SYNTHETIX_ADAPTER_ABI
    // Version-specific contracts
    case LyraContractId.OptionMarketViewer:
    case LyraContractId.OptionMarketWrapper:
    case LyraMarketContractId.LiquidityPool:
    case LyraMarketContractId.OptionGreekCache:
    case LyraMarketContractId.OptionMarket:
    case LyraMarketContractId.OptionMarketPricer:
    case LyraMarketContractId.OptionToken:
    case LyraMarketContractId.ShortCollateral:
    case LyraMarketContractId.PoolHedger:
      return version === Version.Avalon ? getAvalonContractABI(contractId) : getNewportContractABI(contractId)
    case LyraContractId.Multicall3:
      return MULTICALL_3_ABI
  }
}
