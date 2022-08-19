import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { AccountShortOptionHistory } from '..'
import { UNIT } from '../constants/bn'
import { PositionState } from '../constants/contracts'
import { SHORT_OPTION_FRAGMENT } from '../constants/queries'
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
  collateralUpdate: {
    timestamp: number
    amount: string
  }
  transactionHash: string
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
  state: number
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
  trades: PositionTrades[]
  collateralUpdates: PositionCollateralUpdates[]
}

const positionQuery = gql`
  query shortOptionHistory(
    $owner: String, $startTimestamp: Int, $period: Int, $state: Int
  ) {
    positions(
      first: 1000,
      where: {
        owner: $owner,
        isLong: false,
        state: $state
      }
    ) {
      ${SHORT_OPTION_FRAGMENT}
    }
  }
`

export default async function fetchShortOptionHistory(
  lyra: Lyra,
  owner: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<AccountShortOptionHistory[]> {
  const shortOptions = await lyra.subgraphClient.request<{ positions: Position[] }, ShortOptionHistoryVariables>(
    positionQuery,
    {
      owner,
      startTimestamp,
      period: getSnapshotPeriod(startTimestamp, endTimestamp),
      state: PositionState.Active,
    }
  )
  const shortOptionsHistory = shortOptions.positions.reduce(
    (shortOptionsHistory: Record<number, AccountShortOptionHistory>, position) => {
      const tradeEvents = position.trades.reduce((tradeEvents: Record<number, PositionTrades>, trade) => {
        const closestTimestamp = position.option.optionPriceAndGreeksHistory.find(
          optionPriceAndGreeksHistory => trade.timestamp >= optionPriceAndGreeksHistory.timestamp
        )?.timestamp
        if (closestTimestamp) {
          tradeEvents[closestTimestamp] = trade
        }
        return tradeEvents
      }, {})

      const collateralUpdateEvents = position?.collateralUpdates?.reduce(
        (collateralUpdateEvents: Record<number, PositionCollateralUpdates>, collateralUpdate) => {
          const closestTimestamp = position.option.optionPriceAndGreeksHistory.find(
            optionPriceAndGreeksHistory => collateralUpdate.timestamp >= optionPriceAndGreeksHistory.timestamp
          )?.timestamp
          if (closestTimestamp) {
            collateralUpdateEvents[closestTimestamp] = collateralUpdate
          }
          return collateralUpdateEvents
        },
        {}
      )
      let currentPositionSize = BigNumber.from(position.size)
      let currentPositionValue = BigNumber.from(position.option.optionPriceAndGreeksHistory[0]?.optionPrice ?? 0)
        .mul(currentPositionSize)
        .div(UNIT)
      let currentPositionCollateral = BigNumber.from(position.collateral)
      position.option.optionPriceAndGreeksHistory.forEach(optionPriceAndGreeksHistory => {
        let optionPriceTimestamp = optionPriceAndGreeksHistory.timestamp
        if (tradeEvents[optionPriceTimestamp]) {
          const trade = tradeEvents[optionPriceTimestamp]
          optionPriceTimestamp = trade.timestamp // enforces exact timestamp on a trade event instead of nearest timestamp
          currentPositionCollateral = BigNumber.from(trade.collateralUpdate.amount ?? 0)
          if (trade.isBuy) {
            currentPositionSize = currentPositionSize.add(trade.size)
          } else {
            currentPositionSize = currentPositionSize.sub(trade.size)
          }
        }
        if (collateralUpdateEvents && collateralUpdateEvents[optionPriceTimestamp]) {
          const collateralUpdate = collateralUpdateEvents[optionPriceTimestamp]
          currentPositionCollateral = BigNumber.from(collateralUpdate?.amount ?? 0)
        }
        currentPositionValue = currentPositionSize.mul(optionPriceAndGreeksHistory.optionPrice).div(UNIT)
        if (!shortOptionsHistory[optionPriceTimestamp]) {
          shortOptionsHistory[optionPriceTimestamp] = {
            timestamp: optionPriceTimestamp,
            optionValue: currentPositionValue,
            collateralValue: currentPositionCollateral,
          }
        } else {
          shortOptionsHistory[optionPriceTimestamp].optionValue =
            shortOptionsHistory[optionPriceTimestamp].optionValue.add(currentPositionValue)
          shortOptionsHistory[optionPriceTimestamp].collateralValue =
            shortOptionsHistory[optionPriceTimestamp].collateralValue.add(currentPositionCollateral)
        }
      })
      return shortOptionsHistory
    },
    {}
  )
  return Object.values(shortOptionsHistory)
}
