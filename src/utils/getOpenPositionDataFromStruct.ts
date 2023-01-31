import { CollateralUpdateData } from '..'
import { DataSource, PositionState } from '../constants/contracts'
import { OptionToken as AvalonOptionToken } from '../contracts/avalon/typechain/AvalonOptionToken'
import { OptionToken as NewportOptionToken } from '../contracts/newport/typechain/NewportOptionToken'
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
  owner: string,
  positionStruct:
    | NewportOptionToken.OptionPositionStructOutput
    | NewportOptionToken.PositionWithOwnerStructOutput
    | AvalonOptionToken.OptionPositionStructOutput
    | AvalonOptionToken.PositionWithOwnerStructOutput,
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
  const firstTrade = trades[0]
  const lastTrade = trades[trades.length - 1]

  const market = option.market()
  const strike = option.strike()
  const board = option.board()

  // HACK: Ensure first trade timestamp is always set
  const openTimestamp = firstTrade ? firstTrade.timestamp : 0
  const closeTimestamp =
    isSettled && settle ? settle.timestamp : !isOpen ? (lastTrade ? lastTrade.timestamp : null) : null

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
