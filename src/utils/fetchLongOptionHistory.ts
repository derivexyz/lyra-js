import { gql } from 'graphql-request'

import { AccountLongOptionHistory } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import { POSITIONS_FRAGMENT } from '../constants/queries'
import Lyra from '../lyra'

type OptionPriceAndGreeksHistory = {
  id: string
  timestamp: number
  optionPrice: string
}

type PositionCollateralUpdates = {
  id: string
  timestamp: number
  amount: string
}

type PositionTrades = {
  timestamp: number
  isBuy: boolean
  size: string
  premium: string
  blockNumber: number
}

type PositionOption = {
  id: string
  isCall: boolean
  optionPriceAndGreeksHistory: OptionPriceAndGreeksHistory[]
}

type LongOptionHistoryVariables = {
  owner: string
  startTimestamp: number
  period: number
}

type Position = {
  id: string
  owner: string
  option: PositionOption
  isLong: boolean
  isBaseCollateral: boolean
  state: number
  openTimestamp: number
  closeTimestamp: number | null
  size: string
  collateral: string
  trades: PositionTrades[]
  collateralUpdates: PositionCollateralUpdates[]
}

const positionQuery = gql`
  query longOptionHistory(
    $owner: String, $startTimestamp: Int, $period: Int
  ) {
    positions(
      first: 1000,
      orderBy: openTimestamp,
      orderDirection: asc,
      where: {
        owner: $owner,
        isLong: true
      }
    ) {
      ${POSITIONS_FRAGMENT}
    }
  }
`

export default async function fetchLongOptionHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  period: number
): Promise<AccountLongOptionHistory[]> {
  const historicalPositions = await lyra.subgraphClient.request<{ positions: Position[] }, LongOptionHistoryVariables>(
    positionQuery,
    {
      owner,
      startTimestamp,
      period,
    }
  )
  const longOptionsHistory = historicalPositions.positions.reduce(
    (longOptionsHistory: Record<number, AccountLongOptionHistory>, position) => {
      const closeTimestamp = position.closeTimestamp ?? Infinity
      if (closeTimestamp < startTimestamp) {
        return longOptionsHistory
      }
      const tradeEvents = position.trades.reduce((tradeEvents: Record<number, PositionTrades>, trade) => {
        const closestTimestamp =
          position?.option.optionPriceAndGreeksHistory.find(
            optionPriceAndGreeksHistory => optionPriceAndGreeksHistory.timestamp >= trade.timestamp
          )?.timestamp ?? Infinity
        tradeEvents[closestTimestamp] = trade
        return tradeEvents
      }, {})
      let currentPositionSize = ZERO_BN
      let currentPositionValue = ZERO_BN
      position.option.optionPriceAndGreeksHistory.forEach(optionPriceAndGreeksHistory => {
        const timestamp = optionPriceAndGreeksHistory.timestamp
        if (tradeEvents[timestamp]) {
          const trade = tradeEvents[timestamp]
          if (trade.isBuy) {
            currentPositionSize = currentPositionSize.add(trade.size)
          } else {
            currentPositionSize = currentPositionSize.sub(trade.size)
          }
          currentPositionValue = currentPositionSize.mul(optionPriceAndGreeksHistory.optionPrice).div(UNIT)
        }
        if (!longOptionsHistory[timestamp]) {
          longOptionsHistory[timestamp] = {
            timestamp: timestamp,
            optionValue: currentPositionValue,
          }
        } else {
          longOptionsHistory[timestamp].optionValue.add(currentPositionValue)
        }
      })
      return longOptionsHistory
    },
    {}
  )
  return Object.values(longOptionsHistory)
}
