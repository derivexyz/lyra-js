import { CollateralUpdateData } from '..'
import { DataSource, PositionState } from '../constants/contracts'
import { OptionToken } from '../contracts/typechain'
import { Option } from '../option'
import { PositionData } from '../position'
import getPositionCollateral from '../position/getPositionCollateral'
import { SettleEventData } from '../settle_event'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'

export default function getOpenPositionDataFromStruct(
  positionStruct: OptionToken.OptionPositionStructOutput,
  option: Option,
  trades: TradeEventData[],
  collateralUpdates: CollateralUpdateData[],
  transfers: TransferEventData[],
  settle: SettleEventData | null
): PositionData {
  // Position struct
  const id = positionStruct.positionId.toNumber()
  const size = positionStruct.amount
  const optionType = positionStruct.optionType
  const isCall = getIsCall(optionType)
  const isLong = getIsLong(optionType)
  const state = positionStruct.state
  const isOpen = state === PositionState.Active
  const isLiquidated = state === PositionState.Liquidated
  const isSettled = state === PositionState.Settled
  const isBaseCollateral = !isLong && isCall ? getIsBaseCollateral(optionType) : undefined
  const collateral = !isLong
    ? getPositionCollateral(option, size, positionStruct.collateral, isBaseCollateral)
    : undefined

  // Option
  const spotPriceAtExpiry = option.board().spotPriceAtExpiry
  const spotPrice = option.market().spotPrice
  const spotPriceOrAtExpiry = spotPriceAtExpiry ?? spotPrice
  const strikePrice = option.strike().strikePrice
  const isInTheMoney = isCall ? spotPriceOrAtExpiry.gt(strikePrice) : spotPriceOrAtExpiry.lt(strikePrice)

  // Events
  const lastTransfer = transfers.length > 0 ? transfers[transfers.length - 1] : null
  const lastTrade = trades[trades.length - 1]
  // Owner is the last person to trade or be transferred to
  const owner = lastTransfer ? lastTransfer.to : lastTrade.trader

  const market = option.market()
  const strike = option.strike()
  const board = option.board()

  const openTimestamp = trades[0].timestamp
  const closeTimestamp = isSettled && settle ? settle.timestamp : !isOpen ? trades[trades.length - 1].timestamp : null

  return {
    id,
    market,
    source: DataSource.ContractCall,
    blockNumber: market.block.number,
    owner,
    marketName: market.name,
    marketAddress: market.address,
    strikeId: strike.id,
    strikePrice: strike.strikePrice,
    expiryTimestamp: board.expiryTimestamp,
    size,
    isCall,
    isLong,
    state,
    isOpen,
    isLiquidated,
    isSettled,
    collateral,
    pricePerOption: option.price,
    spotPriceAtExpiry,
    isInTheMoney,
    delta: option.delta,
    openTimestamp,
    closeTimestamp,
    trades,
    collateralUpdates,
    transfers,
    settle,
  }
}
