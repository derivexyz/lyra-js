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
transactionHash
amount
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
}
market {
  name
  id
}
option {
  isCall
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
  transactionHash: string
  amount: string
  owner: string
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
  collateral: string
  isBaseCollateral: boolean
  state: PositionState
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
    positionId: string
  }
  trades: TradeQueryResult[]
  collateralUpdates: CollateralUpdateQueryResult[]
}
