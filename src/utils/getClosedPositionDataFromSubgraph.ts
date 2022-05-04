import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { PositionState } from '../constants/contracts'
import { PositionQueryResult } from '../constants/queries'
import { PositionData } from '../position'

export default function getClosedPositionDataFromSubgraph(
  position: PositionQueryResult,
  blockNumber: number
): PositionData {
  const id = position.positionId
  const size = BigNumber.from(position.size)
  const strikeId = parseInt(position.strike.strikeId)
  const isCall = position.option.isCall
  const isLong = position.isLong
  const state = position.state
  const isOpen = state === PositionState.Active
  const isLiquidated = state === PositionState.Liquidated
  const isSettled = state === PositionState.Settled
  // We do not calculate realtime collateral data for closed positions
  const collateral = !isLong
    ? {
        amount: ZERO_BN,
        min: ZERO_BN,
        isBase: isCall ? position.isBaseCollateral : undefined,
        liquidationPrice: ZERO_BN,
      }
    : undefined
  return {
    blockNumber,
    owner: position.owner,
    marketName: position.market.name,
    marketAddress: position.market.id,
    id,
    strikeId,
    strikePrice: BigNumber.from(position.strike.strikePrice),
    expiryTimestamp: position.board.expiryTimestamp,
    isCall,
    isLong,
    state,
    isOpen,
    isLiquidated,
    isSettled,
    // Should always be 0
    size,
    collateral,
    // HACK: Closed positions have $0 value
    optionPrice: ZERO_BN,
  }
}
