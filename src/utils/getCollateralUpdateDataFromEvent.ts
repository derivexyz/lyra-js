import { BigNumber } from 'ethers'

import { CollateralUpdateData } from '../collateral_update_event'
import { ZERO_ADDRESS } from '../constants/bn'
import { Option } from '../option'
import { TradeEventData } from '../trade_event'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import { PartialPositionUpdatedEvent } from './parsePartialPositionUpdatedEventsFromLogs'
import sortEvents from './sortEvents'

// A collateral update is any event which adjusts collateral
export default function getCollateralUpdateDataFromEvent(
  // TODO: @earthtojake Remove Option / TradeEvent dependency on PositionUpdatedEvent
  optionOrTradeEventData: Option | TradeEventData,
  updates: PartialPositionUpdatedEvent[]
): CollateralUpdateData {
  if (new Set(updates.map(t => t.transactionHash)).size > 1) {
    throw new Error('PositionUpdated events have non-unique transaction hashes')
  }
  const latestUpdate = sortEvents(
    // Match trade transaction, remove burns to 0x0
    updates.filter(t => t.args.owner !== ZERO_ADDRESS)
  )[0]
  if (!latestUpdate) {
    throw new Error('No PositionUpdated events for collateral update')
  }

  const positionId = latestUpdate.args.positionId.toNumber()
  const blockNumber = latestUpdate.blockNumber
  const setCollateralTo = latestUpdate.args.position.collateral
  const transactionHash = latestUpdate.transactionHash
  const strikeId = latestUpdate.args.position.strikeId.toNumber()
  const isCall = getIsCall(latestUpdate.args.position.optionType)

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
  const timestamp = latestUpdate.args.timestamp.toNumber()
  const owner = latestUpdate.args.owner

  if (getIsCall(latestUpdate.args.position.optionType) !== isCall) {
    throw new Error('Option and PositionUpdateEvent mismatch')
  }
  const isBaseCollateral = getIsBaseCollateral(latestUpdate.args.position.optionType)
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
