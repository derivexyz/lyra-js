import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'

import { CollateralUpdateData } from '../collateral_update_event'
import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource, PositionState } from '../constants/contracts'
import { PositionQueryResult } from '../constants/queries'
import { Market } from '../market'
import { Option } from '../option'
import { PositionData } from '../position'
import getPositionCollateral, { PositionCollateral } from '../position/getPositionCollateral'
import { SettleEventData } from '../settle_event'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'
import getMaxCollateral from './getMaxCollateral'

export default function getPositionDataFromSubgraph(
  position: PositionQueryResult,
  market: Market,
  trades: TradeEventData[],
  collateralUpdates: CollateralUpdateData[],
  transfers: TransferEventData[],
  settle: SettleEventData | null,
  ignoreLiquidationPrice?: boolean
): PositionData {
  const id = position.positionId
  const strikeId = parseInt(position.strike.strikeId)
  const boardId = parseInt(position.board.boardId)
  const isCall = position.option.isCall
  const isLong = position.isLong
  const state = position.state
  const isOpen = state === PositionState.Active
  const isLiquidated = state === PositionState.Liquidated
  const isSettled = state === PositionState.Settled
  const size = [PositionState.Closed, PositionState.Liquidated].includes(state)
    ? ZERO_BN
    : BigNumber.from(position.size)

  let liveOption: Option | null
  // Try get live board
  try {
    liveOption = boardId ? market.liveBoard(boardId).strike(strikeId).option(isCall) : null
  } catch {
    liveOption = null
  }
  const pricePerOption = liveOption ? liveOption.price : ZERO_BN
  const strikePrice = BigNumber.from(position.strike.strikePrice)
  const isBaseCollateral = isCall ? !!position.isBaseCollateral : false

  const spotPriceAtExpiry = position.board.spotPriceAtExpiry
    ? BigNumber.from(position.board.spotPriceAtExpiry)
    : undefined
  const spotPrice = market.spotPrice
  const spotPriceOrAtExpiry = spotPriceAtExpiry ?? spotPrice
  const isInTheMoney = isCall ? spotPriceOrAtExpiry.gt(strikePrice) : spotPriceOrAtExpiry.lt(strikePrice)

  // TODO: @dappbeast Fix subgraph to maintain last collateral amount on settle
  const collateralAmount =
    isOpen || isSettled ? collateralUpdates[collateralUpdates.length - 1]?.amount ?? ZERO_BN : ZERO_BN

  const collateral: PositionCollateral | undefined = !isLong
    ? liveOption && !ignoreLiquidationPrice
      ? getPositionCollateral(liveOption, size, collateralAmount, isBaseCollateral)
      : {
          amount: collateralAmount,
          value: isBaseCollateral ? collateralAmount.mul(spotPrice).div(UNIT) : collateralAmount,
          min: ZERO_BN,
          max: getMaxCollateral(isCall, strikePrice, size, isBaseCollateral),
          isBase: isBaseCollateral,
          liquidationPrice: null,
        }
    : undefined

  const marketName = market.name
  const marketAddress = getAddress(market.address)
  const owner = getAddress(position.owner)
  const expiryTimestamp = position.board.expiryTimestamp

  const openTimestamp = trades[0].timestamp
  const closeTimestamp = isSettled && settle ? settle.timestamp : !isOpen ? trades[trades.length - 1].timestamp : null

  return {
    id,
    market,
    source: DataSource.Subgraph,
    blockNumber: market.block.number,
    delta: liveOption?.delta ?? ZERO_BN,
    owner,
    marketName,
    marketAddress,
    strikeId,
    strikePrice,
    expiryTimestamp,
    isCall,
    isLong,
    state,
    isOpen,
    isLiquidated,
    isSettled,
    size,
    collateral,
    pricePerOption,
    spotPriceAtExpiry,
    isInTheMoney,
    openTimestamp,
    closeTimestamp,
    trades,
    collateralUpdates,
    transfers,
    settle,
  }
}
