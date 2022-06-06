// NOTE: Do not import typechain types in this file
// Contract name mappings
export enum LyraContractId {
  OptionMarketViewer = 'OptionMarketViewer',
  OptionMarketWrapper = 'OptionMarketWrapper',
  TestFaucet = 'TestFaucet',
  SynthetixAdapter = 'SynthetixAdapter',
}
// Per-market contract name mappings
export enum LyraMarketContractId {
  OptionMarket = 'OptionMarket',
  OptionMarketPricer = 'OptionMarketPricer',
  OptionToken = 'OptionToken',
  ShortCollateral = 'ShortCollateral',
  OptionGreekCache = 'OptionGreekCache',
  LiquidityTokens = 'LiquidityTokens',
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
  Local = 'local',
  Kovan = 'kovan',
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

// DEBUG
export const USDC_ADDRESS = '0x4e3e4889c08BFd2d202FACbae3978499B1E27366'

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
