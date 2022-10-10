// NOTE: Do not import typechain types in this file
// Contract name mappings

export enum LyraContractId {
  OptionMarketViewer = 'OptionMarketViewer',
  OptionMarketWrapper = 'OptionMarketWrapper',
  TestFaucet = 'TestFaucet',
  SynthetixAdapter = 'SynthetixAdapter',
  LyraStakingModuleProxy = 'LyraStakingModuleProxy',
  LyraRegistry = 'LyraRegistry',
  MultiDistributor = 'MultiDistributor',
  ArrakisPool = 'ArrakisPool',
  WethLyraStakingRewards = 'WethLyraStakingRewards',
}

// Per-market contract name mappings
export enum LyraMarketContractId {
  OptionMarket = 'OptionMarket',
  OptionMarketPricer = 'OptionMarketPricer',
  OptionToken = 'OptionToken',
  ShortCollateral = 'ShortCollateral',
  OptionGreekCache = 'OptionGreekCache',
  LiquidityToken = 'LiquidityToken',
  LiquidityPool = 'LiquidityPool',
  ShortPoolHedger = 'ShortPoolHedger',
}
// Ordered enum from contracts
export enum OptionType {
  LongCall,
  LongPut,
  ShortCoveredCall,
  ShortCall,
  ShortPut,
}

export enum Deployment {
  Local = 'local',
  Kovan = 'kovan',
  Goerli = 'goerli',
  Mainnet = 'mainnet',
}
export const DEFAULT_ITERATIONS = 1
export const DEFAULT_PREMIUM_SLIPPAGE = 0.1 / 100 // 0.1%
export const DEFAULT_SWAP_SLIPPAGE = 0.1 / 100 // 0.1%
export const CURVE_POOL_FEE_RATE = 0.4 / 100 // 0.4%
export enum EventName {
  Trade = 'Trade',
  PositionUpdated = 'PositionUpdated',
  Transfer = 'Transfer',
}
export enum PositionState {
  Empty,
  Active,
  Closed,
  Liquidated,
  Settled,
  Merged,
}
export enum PositionUpdatedType {
  Opened,
  Adjusted,
  Closed,
  SplitFrom,
  SplitInto,
  Merged,
  MergedInto,
  Settled,
  Liquidated,
  Transfer,
}
export enum TradeDirection {
  Open,
  Close,
  Liquidate,
}
export enum DataSource {
  ContractCall = 'ContractCall',
  Log = 'Log',
  Subgraph = 'Subgraph',
}

export const POSITION_UPDATED_TYPES = [
  PositionUpdatedType.Adjusted,
  PositionUpdatedType.Closed,
  PositionUpdatedType.Liquidated,
  PositionUpdatedType.Opened,
  PositionUpdatedType.Settled,
  PositionUpdatedType.Merged,
  PositionUpdatedType.MergedInto,
  PositionUpdatedType.SplitFrom,
  PositionUpdatedType.SplitInto,
]

export const LYRA_OPTIMISM_MAINNET_ADDRESS = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'
export const LYRA_OPTIMISM_KOVAN_ADDRESS = '0xC9801013F0c45F836Ad07Dded1df9C475d2844FC'
export const OP_OPTIMISM_MAINNET_ADDRESS = '0x4200000000000000000000000000000000000042'
export const STAKED_LYRA_OPTIMISM_ADDRESS = '0xde48b1b5853cc63b1d05e507414d3e02831722f8'
export const STAKED_LYRA_OPTIMISM_KOVAN_ADDRESS = '0xd16d254c42a03ad72d77b4226d086afcc0b2e43e'
export const ONE_INCH_ORACLE_OPTIMISM_MAINNET_ADDRESS = '0x11DEE30E710B8d4a8630392781Cc3c0046365d4c'
export const USDC_OPTIMISM_MAINNET_ADDRESS = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
export const WETH_OPTIMISM_MAINNET_ADDRESS = '0x4200000000000000000000000000000000000006'
export const USDC_OPTIMISM_MAINNET_DECIMALS = 6
export const VAULTS_UTILIZATION_THRESHOLD = 0.99
