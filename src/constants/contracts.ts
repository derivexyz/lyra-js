// NOTE: Do not import typechain types in this file
// Contract name mappings

export enum LyraContractId {
  OptionMarketViewer = 'OptionMarketViewer',
  LyraRegistry = 'LyraRegistry',
  ExchangeAdapter = 'ExchangeAdapter',
  TestFaucet = 'TestFaucet',
}

export enum LyraGlobalContractId {
  MultiDistributor = 'MultiDistributor',
  Multicall3 = 'Multicall3',
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
  PoolHedger = 'PoolHedger',
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
  Testnet = 'testnet',
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

export const LYRA_ETHEREUM_MAINNET_ADDRESS = '0x01BA67AAC7f75f647D94220Cc98FB30FCc5105Bf'
export const OP_OPTIMISM_MAINNET_ADDRESS = '0x4200000000000000000000000000000000000042'
export const LYRA_ETHEREUM_KOVAN_ADDRESS = '0xC9801013F0c45F836Ad07Dded1df9C475d2844FC'

export const VAULTS_UTILIZATION_THRESHOLD = 0.99
