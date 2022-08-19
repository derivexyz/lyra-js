import { BigNumber } from '@ethersproject/bignumber'

import { ZERO_BN } from '../constants/bn'
import { PositionState } from '../constants/contracts'
import { PositionQueryResult } from '../constants/queries'
import { PositionData } from '../position'
import getMaxCollateral from './getMaxCollateral'

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
  // Hardcode isOpen to false (deals with closed position edge case)
  const isOpen = false
  const isLiquidated = state === PositionState.Liquidated
  const isSettled = state === PositionState.Settled
  const strikePrice = BigNumber.from(position.strike.strikePrice)
  const isBase = isCall ? !!position.isBaseCollateral : false
  // We do not calculate realtime collateral data for closed positions
  const collateral =
    !isLong && position.collateral
      ? {
          amount: BigNumber.from(position.collateral),
          max: getMaxCollateral(isCall, strikePrice, size, isBase),
          isBase,
          // TODO: @earthtojake Populate liquidation price with subgraph data
          liquidationPrice: null,
          // TODO: @earthtojake Populate min collateral with subgraph data
          min: ZERO_BN,
        }
      : undefined
  const spotPriceAtExpiry = position.board.spotPriceAtExpiry
    ? BigNumber.from(position.board.spotPriceAtExpiry)
    : undefined
  const spotPrice = spotPriceAtExpiry ?? BigNumber.from(position.market.latestSpotPrice)
  const isInTheMoney = isCall ? spotPrice.gt(strikePrice) : spotPrice.lt(strikePrice)
  return {
    blockNumber,
    owner: position.owner,
    marketName: position.market.name,
    marketAddress: position.market.id,
    id,
    strikeId,
    strikePrice,
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
    pricePerOption: ZERO_BN,
    spotPriceAtExpiry,
    isInTheMoney,
  }
}
