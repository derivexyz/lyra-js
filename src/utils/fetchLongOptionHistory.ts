import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { AccountLongOptionHistory } from '..'
import { UNIT } from '../constants/bn'
import { PositionState } from '../constants/contracts'
import { LONG_OPTION_FRAGMENT } from '../constants/queries'
import Lyra from '../lyra'
import getSnapshotPeriod from './getSnapshotPeriod'

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
  transactionHash: string
  collateralUpdate: {
    timestamp: number
    amount: string
  }
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
  state: number
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
    $owner: String
    $startTimestamp: Int
    $period: Int
    $state: Int
  ) {
    positions(
      first: 1000,
      where: {
        owner: $owner,
        isLong: true,
        state: $state
      }
    ) {
      ${LONG_OPTION_FRAGMENT}
    }
  }
`

export default async function fetchLongOptionHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<AccountLongOptionHistory[]> {
  const longOptions = await lyra.subgraphClient.request<{ positions: Position[] }, LongOptionHistoryVariables>(
    positionQuery,
    {
      owner,
      startTimestamp,
      period: getSnapshotPeriod(startTimestamp, endTimestamp),
      state: PositionState.Active,
    }
  )
  const longOptionsHistory: Record<number, AccountLongOptionHistory> = {}
  longOptions.positions.forEach(position => {
    const tradeEvents = position.trades.reduce((tradeEvents: Record<number, PositionTrades>, trade) => {
      const closestTimestamp =
        position.option.optionPriceAndGreeksHistory.find(
          optionPriceAndGreeksHistory => trade.timestamp >= optionPriceAndGreeksHistory.timestamp
        )?.timestamp ?? Infinity
      tradeEvents[closestTimestamp] = trade
      return tradeEvents
    }, {})
    let currentPositionSize = BigNumber.from(position.size)
    let currentPositionValue = BigNumber.from(position.option.optionPriceAndGreeksHistory[0].optionPrice)
      .mul(currentPositionSize)
      .div(UNIT)
    position.option.optionPriceAndGreeksHistory.forEach(optionPriceAndGreeksHistory => {
      let optionPriceTimestamp = optionPriceAndGreeksHistory.timestamp
      if (tradeEvents[optionPriceTimestamp]) {
        const trade = tradeEvents[optionPriceTimestamp]
        optionPriceTimestamp = trade.timestamp // enforces exact timestamp on a trade event instead of nearest timestamp
        if (trade.isBuy) {
          currentPositionSize = currentPositionSize.sub(trade.size)
        } else {
          currentPositionSize = currentPositionSize.add(trade.size)
        }
      }
      currentPositionValue = currentPositionSize.mul(optionPriceAndGreeksHistory.optionPrice).div(UNIT)
      if (!longOptionsHistory[optionPriceTimestamp]) {
        longOptionsHistory[optionPriceTimestamp] = {
          timestamp: optionPriceTimestamp,
          optionValue: currentPositionValue,
        }
      } else {
        longOptionsHistory[optionPriceTimestamp].optionValue =
          longOptionsHistory[optionPriceTimestamp].optionValue.add(currentPositionValue)
      }
    })
  })
  return Object.values(longOptionsHistory)
}
