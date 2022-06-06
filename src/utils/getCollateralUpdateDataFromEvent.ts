import { BigNumber } from '@ethersproject/bignumber'

import { CollateralUpdateData } from '../collateral_update_event'
import { PartialPositionUpdatedEvent, PartialTransferEvent } from '../constants/events'
import { Option } from '../option'
import { TradeEventData } from '../trade_event'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import getOwner from './getOwner'

// A collateral update is any event which adjusts collateral
export default function getCollateralUpdateDataFromEvent(
  // TODO: @earthtojake Remove Option / TradeEvent dependency on PositionUpdatedEvent
  update: PartialPositionUpdatedEvent,
  optionOrTradeEventData: Option | TradeEventData,
  transfers: PartialTransferEvent[]
): CollateralUpdateData {
  const positionId = update.args.positionId.toNumber()
  const blockNumber = update.blockNumber
  const setCollateralTo = update.args.position.collateral
  const transactionHash = update.transactionHash
  const strikeId = update.args.position.strikeId.toNumber()
  const isCall = getIsCall(update.args.position.optionType)

  let marketName: string
  let marketAddress: string
  let strikePrice: BigNumber
  let expiryTimestamp: number
  if (optionOrTradeEventData instanceof Option) {
    const option = optionOrTradeEventData
    marketName = option.market().name
    strikePrice = option.strike().strikePrice
    marketAddress = option.market().address
    expiryTimestamp = option.board().expiryTimestamp
  } else {
    const trade = optionOrTradeEventData
    marketName = trade.marketName
    marketAddress = trade.marketAddress
    strikePrice = trade.strikePrice
    expiryTimestamp = trade.expiryTimestamp
  }
  const timestamp = update.args.timestamp.toNumber()
  const owner = getOwner(transfers, blockNumber)

  if (optionOrTradeEventData.isCall !== isCall) {
    throw new Error('Option / TradeEvent and PositionUpdateEvent mismatch')
  }
  const isBaseCollateral = getIsBaseCollateral(update.args.position.optionType)
  return {
    owner,
    timestamp,
    positionId,
    strikeId,
    transactionHash,
    marketAddress,
    expiryTimestamp,
    blockNumber,
    setCollateralTo,
    marketName,
    strikePrice,
    isCall,
    isBaseCollateral,
  }
}
