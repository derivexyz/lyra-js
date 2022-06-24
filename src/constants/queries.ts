import { PositionState } from './contracts'

export const TRADE_QUERY_FRAGMENT = `
timestamp
blockNumber
transactionHash
trader
size
isOpen
isBuy
spotPrice
premium
spotPriceFee
optionPriceFee
vegaUtilFee
varianceFee
externalSwapFees
setCollateralTo
newIv
newBaseIv
newSkew
volTraded
isForceClose
isLiquidation
strike {
  strikeId
  strikePrice
}
board {
  expiryTimestamp
}
market {
  name
  id
}
option {
  isCall
}
position {
  positionId
  isLong
  isBaseCollateral
}
`

export const COLLATERAL_UPDATE_QUERY_FRAGMENT = `
timestamp
trader
blockNumber
transactionHash
amount
isBaseCollateral
strike {
  strikeId
  strikePrice
}
board {
  expiryTimestamp
}
market {
  name
  id
}
option {
  isCall
}
position {
  positionId
  isLong
  isBaseCollateral
}
`

export const POSITION_QUERY_FRAGMENT = `
id
positionId
owner
size
isLong
collateral
isBaseCollateral
state
strike {
  strikeId
  strikePrice
}
board {
  expiryTimestamp
  spotPriceAtExpiry
}
market {
  name
  id
  latestSpotPrice
}
option {
  isCall
  latestOptionPriceAndGreeks {
    optionPrice
  }
}
trades {
  ${TRADE_QUERY_FRAGMENT}
}
collateralUpdates {
  ${COLLATERAL_UPDATE_QUERY_FRAGMENT}
}
`

export const META_QUERY = `
_meta {
  block {
    number
  }
}
`

export const MARKET_TOTAL_VALUE_SNAPSHOT_FRAGMENT = `
  id
  period
  timestamp
  tokenPrice
  freeLiquidity
  burnableLiquidity
  usedCollatLiquidity
  pendingDeltaLiquidity
  usedDeltaLiquidity
  NAV
  netOptionValue
  pendingDeposits
  pendingWithdrawals
`

export const MARKET_GREEKS_SNAPSHOT_FRAGMENT = `
  id
  period
  timestamp
  netDelta
  poolNetDelta
  hedgerNetDelta
  netStdVega
`

export const MARKET_VOLUME_AND_FEES_SNAPSHOT_FRAGMENT = `
  id
  timestamp
  period
  premiumVolume
  notionalVolume
  totalPremiumVolume
  totalNotionalVolume
  spotPriceFees
  optionPriceFees
  vegaFees
  varianceFees
  deltaCutoffFees
  liquidatorFees
  smLiquidationFees
  lpLiquidationFees
`

export const MARKET_PENDING_LIQUIDITY_SNAPSHOT_FRAGMENT = `
  id
  period
  timestamp
  pendingDepositAmount
  pendingWithdrawalAmount
`

export const SPOT_PRICE_SNAPSHOT_FRAGMENT = `
  timestamp
  spotPrice
`

export const POSITIONS_FRAGMENT = `
  option {
    id
    isCall
    optionPriceAndGreeksHistory(
      first: 1000,
      orderBy: timestamp,
      orderDirection: asc,
      where: {
        timestamp_gte: $startTimestamp,
        period_gte: $period
      }
    ) {
      id
      timestamp
      optionPrice
    }
  }
  id
  openTimestamp
  closeTimestamp
  size
  collateral
  trades {
    timestamp
    isBuy
    size
    premium
    blockNumber
  }
`

export const OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT = `
  timestamp
  optionPrice
`

export const STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT = `
  timestamp
  iv
`

export const MARKET_SPOT_PRICE_SNAPSHOT_FRAGMENT = `
  spotPrice
  timestamp
`

export type MetaQueryResult = {
  block: {
    number: number
  }
}

export type TradeQueryResult = {
  timestamp: number
  blockNumber: number
  transactionHash: string
  setCollateralTo: string
  trader: string
  size: string
  isOpen: boolean
  isBuy: boolean
  spotPrice: string
  premium: string
  spotPriceFee: string
  optionPriceFee: string
  vegaUtilFee: string
  varianceFee: string
  externalSwapFees: string
  strike: {
    strikeId: string
    strikePrice: string
  }
  board: {
    expiryTimestamp: number
  }
  market: {
    name: string
    id: string
  }
  option: {
    isCall: boolean
  }
  position: {
    positionId: number
    isLong: boolean
    isBaseCollateral: boolean
  }
  newIv: string
  newBaseIv: string
  newSkew: string
  volTraded: string
  isLiquidation: boolean
  isForceClose: boolean
}

export type CollateralUpdateQueryResult = {
  timestamp: number
  blockNumber: number
  transactionHash: string
  amount: string
  trader: string
  isBaseCollateral: boolean
  strike: {
    strikeId: string
    strikePrice: string
  }
  board: {
    expiryTimestamp: number
  }
  market: {
    name: string
    id: string
  }
  option: {
    isCall: boolean
  }
  position: {
    positionId: number
    isLong: boolean
    isBaseCollateral: boolean
  }
}

export type PositionQueryResult = {
  id: string
  positionId: number
  owner: string
  size: string
  isLong: boolean
  collateral: string | null
  isBaseCollateral: boolean
  state: PositionState
  strike: {
    strikeId: string
    strikePrice: string
  }
  board: {
    expiryTimestamp: number
    spotPriceAtExpiry: string | null
  }
  market: {
    name: string
    id: string
    latestSpotPrice: string
  }
  option: {
    isCall: boolean
    latestOptionPriceAndGreeks: {
      optionPrice: string
    }
  }
  position: {
    positionId: string
  }
  trades: TradeQueryResult[]
  collateralUpdates: CollateralUpdateQueryResult[]
}

export type MarketTotalValueSnapshotQueryResult = {
  id: string
  period: number
  timestamp: number
  tokenPrice: string
  freeLiquidity: string
  burnableLiquidity: string
  usedCollatLiquidity: string
  pendingDeltaLiquidity: string
  usedDeltaLiquidity: string
  NAV: string
  netOptionValue: string
  pendingDeposits: string
  pendingWithdrawals: string
}

export type MarketGreeksSnapshotQueryResult = {
  id: string
  period: number
  timestamp: number
  netDelta: string
  poolNetDelta: string
  hedgerNetDelta: string
  netStdVega: string
}

export type MarketVolumeAndFeesSnapshotQueryResult = {
  id: string
  timestamp: number
  period: number
  premiumVolume: string
  notionalVolume: string
  totalPremiumVolume: string
  totalNotionalVolume: string
  spotPriceFees: string
  optionPriceFees: string
  vegaFees: string
  varianceFees: string
  deltaCutoffFees: string
  liquidatorFees: string
  smLiquidationFees: string
  lpLiquidationFees: string
}

export type MarketPendingLiquiditySnapshotQueryResult = {
  id: string
  period: number
  timestamp: number
  pendingDepositAmount: string
  pendingWithdrawalAmount: string
}

export type SpotPriceSnapshotQueryResult = {
  timestamp: number
  spotPrice: string
}

export type OptionPriceAndGreeksSnapshotQueryResult = {
  timestamp: number
  optionPrice: string
}

export type StrikeIVAndGreeksSnapshotQueryResult = {
  timestamp: number
  iv: string
}

export type MarketSpotPriceSnapshotQueryResult = {
  spotPrice: string
  timestamp: number
}

export enum SnapshotPeriod {
  FifteenMinutes = 900,
  OneHour = 3600,
  OneDay = 86400,
}
