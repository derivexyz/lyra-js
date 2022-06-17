import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { AccountShortOptionHistory } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import { POSITIONS_FRAGMENT } from '../constants/queries'
import Lyra from '../lyra'

type OptionPriceAndGreeksHistory = {
  id: string
  timestamp: number
  optionPrice: string
}

type PortfolioCollateralUpdates = {
  id: string
  timestamp: number
  amount: string
}

type PortfolioTrade = {
  timestamp: number
  isBuy: boolean
  size: string
  premium: string
  blockNumber: number
  collateralUpdate: {
    timestamp: number
    amount: string
  }
}

type PortfolioOption = {
  id: string
  isCall: boolean
  optionPriceAndGreeksHistory: OptionPriceAndGreeksHistory[]
}

type ShortOptionHistoryVariables = {
  owner: string
  startTimestamp: number
  period: number
}

type Position = {
  id: string
  owner: string
  option: PortfolioOption
  isLong: boolean
  isBaseCollateral: boolean
  state: number
  openTimestamp: number
  closeTimestamp: number | null
  size: string
  collateral: string
  trades: PortfolioTrade[]
  collateralUpdates: PortfolioCollateralUpdates[]
}

const positionQuery = gql`
  query shortOptionHistory(
    $owner: String, $startTimestamp: Int, $period: Int
  ) {
    positions(
      first: 1000,
      orderBy: openTimestamp,
      orderDirection: asc,
      where: {
        owner: $owner,
        isLong: false
      }
    ) {
      ${POSITIONS_FRAGMENT}
    }
  }
`

export default async function fetchShortOptionHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  period: number
): Promise<AccountShortOptionHistory[]> {
  const historicalPositions = await lyra.subgraphClient.request<{ positions: Position[] }, ShortOptionHistoryVariables>(
    positionQuery,
    {
      owner,
      startTimestamp,
      period,
    }
  )
  const shortOptionsHistory = historicalPositions.positions.reduce(
    (shortOptionsHistory: Record<number, AccountShortOptionHistory>, position) => {
      const closeTimestamp = position.closeTimestamp ?? Infinity
      if (closeTimestamp < startTimestamp) {
        return shortOptionsHistory
      }

      const tradeEvents = position.trades.reduce((tradeEvents: Record<number, PortfolioTrade>, trade) => {
        const closestTimestamp =
          position?.option.optionPriceAndGreeksHistory.find(
            optionPriceAndGreeksHistory => optionPriceAndGreeksHistory.timestamp >= trade.timestamp
          )?.timestamp ?? Infinity
        tradeEvents[closestTimestamp] = trade
        return tradeEvents
      }, {})

      let currentPositionSize = ZERO_BN
      let currentPositionValue = ZERO_BN
      let currentPositionCollateral = ZERO_BN
      position.option.optionPriceAndGreeksHistory.forEach(optionPriceAndGreeksHistory => {
        const timestamp = optionPriceAndGreeksHistory.timestamp
        if (tradeEvents[timestamp]) {
          const trade = tradeEvents[timestamp]
          currentPositionCollateral = BigNumber.from(trade?.collateralUpdate?.amount ?? '0')
          if (trade.isBuy) {
            currentPositionSize = currentPositionSize.add(trade.size)
          } else {
            currentPositionSize = currentPositionSize.sub(trade.size)
          }
          currentPositionValue = currentPositionSize.mul(optionPriceAndGreeksHistory.optionPrice).div(UNIT)
        }
        if (!shortOptionsHistory[timestamp]) {
          shortOptionsHistory[timestamp] = {
            timestamp: timestamp,
            optionValue: currentPositionValue,
            collateralValue: currentPositionCollateral,
          }
        } else {
          shortOptionsHistory[timestamp].optionValue.add(currentPositionValue)
          shortOptionsHistory[timestamp].collateralValue.add(currentPositionCollateral)
        }
      })
      return shortOptionsHistory
    },
    {}
  )
  return Object.values(shortOptionsHistory)
}
