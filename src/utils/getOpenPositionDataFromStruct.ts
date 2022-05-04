import { PositionState } from '../constants/contracts'
import { OptionToken } from '../contracts/typechain'
import Option from '../option'
import { PositionData } from '../position'
import getPositionCollateral from '../position/getPositionCollateral'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'

export default function getOpenPositionDataFromStruct(
  owner: string,
  option: Option,
  positionStruct: OptionToken.OptionPositionStructOutput | OptionToken.PositionWithOwnerStructOutput
): PositionData {
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
  return {
    blockNumber: option.board().__blockNumber,
    owner,
    marketName: option.market().name,
    marketAddress: option.market().address,
    id,
    strikeId: option.strike().id,
    strikePrice: option.strike().strikePrice,
    expiryTimestamp: option.board().expiryTimestamp,
    size,
    isCall,
    isLong,
    state,
    isOpen,
    isLiquidated,
    isSettled,
    collateral,
    optionPrice: option.price,
  }
}
