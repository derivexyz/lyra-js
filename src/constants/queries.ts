import { BigNumber } from '@ethersproject/bignumber'

import { PositionState } from './contracts'

export const MIN_START_TIMESTAMP = 0
export const MAX_END_TIMESTAMP = 2147483647
export const SNAPSHOT_RESULT_LIMIT = 1000

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
spotPrice
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

export const SETTLE_QUERY_FRAGMENT = `
id
blockNumber
profit
size
spotPriceAtExpiry
timestamp
transactionHash
owner
settleAmount
position {
  positionId
  isBaseCollateral
  isLong
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
    latestSpotPrice
  }
  option {
    isCall
  }
}
`

export const TRANSFER_QUERY_FRAGMENT = `
  oldOwner
  newOwner
  transactionHash
  blockNumber
  position {
    positionId
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
openTimestamp
closeTimestamp
strike {
  strikeId
  strikePrice
}
board {
  boardId
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
trades(orderBy: timestamp, orderDirection: asc) {
  ${TRADE_QUERY_FRAGMENT}
}
collateralUpdates(orderBy: timestamp, orderDirection: asc) {
  ${COLLATERAL_UPDATE_QUERY_FRAGMENT}
}
transfers(orderBy: timestamp, orderDirection: asc) {
  ${TRANSFER_QUERY_FRAGMENT}
}
settle {
  ${SETTLE_QUERY_FRAGMENT}
}
`

export type PartialPositionQueryResult = {
  positionId: number
  isLong: boolean
  isBaseCollateral: boolean
}

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
  blockNumber
`

export const LONG_OPTION_FRAGMENT = `
  option {
    id
    isCall
    optionPriceAndGreeksHistory(
      first: 1000,
      orderBy: timestamp,
      orderDirection: desc,
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
  trades(
    first: 1000,
    orderBy: timestamp,
    orderDirection: desc,
  ) {
    timestamp
    isBuy
    size
    premium
    blockNumber
    transactionHash
    collateralUpdate {
      timestamp
      amount
    }
  }
`

export const SHORT_OPTION_FRAGMENT = `
  ${LONG_OPTION_FRAGMENT}
  collateralUpdates(
    first: 1000,
    orderBy: timestamp,
    orderDirection: desc,
  ) {
    id
    timestamp
    amount
  }
`

export const OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT = `
  timestamp
  optionPrice
  id
  blockNumber
  option {
    id
  }
`

export const OPTION_VOLUME_FRAGMENT = `
  notionalVolume
  premiumVolume
  timestamp
`

export const STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT = `
  timestamp
  iv
`

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
  externalSwapAddress: string
}

export type TransferQueryResult = {
  oldOwner: string
  newOwner: string
  transactionHash: string
  blockNumber: number
  position: {
    positionId: number
  }
}

export type SettleQueryResult = {
  id: string
  blockNumber: number
  profit: string
  size: string
  spotPriceAtExpiry: string
  timestamp: number
  transactionHash: string
  owner: string
  settleAmount: string
  position: {
    positionId: number
    isBaseCollateral: boolean
    isLong: boolean
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
      latestSpotPrice: string
    }
    option: {
      isCall: boolean
    }
  }
}

export type CollateralUpdateQueryResult = {
  timestamp: number
  blockNumber: number
  transactionHash: string
  amount: string
  trader: string
  isBaseCollateral: boolean
  spotPrice: string
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
  externalSwapFees: string
  externalSwapAddress: string
  externalSwapAmount: string
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
  openTimestamp: number
  closeTimestamp: number
  strike: {
    strikeId: string
    strikePrice: string
  }
  board: {
    boardId: string
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
  trades: TradeQueryResult[]
  collateralUpdates: CollateralUpdateQueryResult[]
  transfers: TransferQueryResult[]
  settle: SettleQueryResult
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

export type OptionPriceAndGreeksSnapshotQueryResult = {
  timestamp: number
  blockNumber: number
  optionPrice: string
  id: string
  option: {
    id: string
  }
}

export type OptionVolumeQueryResult = {
  premiumVolume: string
  notionalVolume: string
  timestamp: number
}

export type StrikeIVAndGreeksSnapshotQueryResult = {
  timestamp: number
  iv: string
}

export type SpotPriceSnapshotQueryResult = {
  spotPrice: string
  timestamp: number
  blockNumber: number
}

export enum SnapshotPeriod {
  OneHour = 3600,
  OneDay = 86400,
}

export type TokenTransferResult = {
  amount: string
  timestamp: number
  blockNumber: number
  from: string
  to: string
  token: {
    id: string
  }
}

export type TokenTransfer = {
  amount: BigNumber
  timestamp: number
  blockNumber: number
  from: string
  to: string
  tokenAddress: string
}
