import { BigNumber } from 'ethers'

import { CollateralUpdateData } from '../collateral_update_event'
import { ZERO_ADDRESS } from '../constants/bn'
import { Option } from '../option'
import { TradeEventData } from '../trade_event'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import { PartialPositionUpdatedEvent } from './parsePartialPositionUpdatedEventsFromLogs'
import { PartialTransferEvent } from './parsePartialTransferEventFromLogs'
import sortEvents from './sortEvents'

export default function getCollateralUpdateDataFromEvent(
  // TODO: @earthtojake Remove Option / TradeEvent dependency on PositionUpdatedEvent
  optionOrTradeEventData: Option | TradeEventData,
  update: PartialPositionUpdatedEvent,
  transfers: PartialTransferEvent[],
  // TODO: @earthtojake Put timestamp in PositionUpdatedEvent
  timestamp: number
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

  // If transfers exist, owner is last transfer
  // TODO: @earthtojake Add owner field to PositionUpdated events
  let owner = ''
  // Reverse chronological (most to least recent)
  const latestTransfer = sortEvents(
    // Match trade transaction, remove burns to 0x0
    transfers.filter(t => t.transactionHash === update.transactionHash && t.args.to !== ZERO_ADDRESS)
  ).reverse()[0]
  if (latestTransfer) {
    owner = latestTransfer.args.to
  }

  if (getIsCall(update.args.position.optionType) !== isCall) {
    throw new Error('Option and PositionUpdateEvent mismatch')
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
