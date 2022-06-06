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
`

export const MARKET_GREEKS_SNAPSHOT_FRAGMENT = `
  id
  period
  timestamp
  netDelta
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

export const MARKET_SPOT_PRICE_SNAPSHOT_FRAGMENT = `
  spotPrice
  timestamp
`

export const POOL_HEDGER_EXPOSURE_SNAPSHOT_FRAGMENT = `
  timestamp
  currentNetDelta
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
}

export type MarketGreeksSnapshotQueryResult = {
  id: string
  period: number
  timestamp: number
  netDelta: string
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

export type MarketSpotPriceSnapshotQueryResult = {
  spotPrice: string
  timestamp: number
}

export type PoolHedgerExposureSnapshotQueryResult = {
  timestamp: number
  currentNetDelta: string
}
