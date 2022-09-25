import { CollateralUpdateData } from '../collateral_update_event'
import { UNIT } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { PartialPositionUpdatedEvent, PartialTransferEvent } from '../constants/events'
import { Market } from '../market'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'
import getPositionOwner from './getPositionOwner'

export default function getCollateralUpdateDataFromRecentEvent(
  update: PartialPositionUpdatedEvent,
  market: Market,
  transfers: PartialTransferEvent[]
): CollateralUpdateData {
  const positionId = update.args.positionId.toNumber()
  const blockNumber = update.blockNumber
  const amount = update.args.position.collateral
  const transactionHash = update.transactionHash
  const strikeId = update.args.position.strikeId.toNumber()
  const isCall = getIsCall(update.args.position.optionType)
  const isLong = getIsLong(update.args.position.optionType)

  if (isLong) {
    throw new Error('Attempted to create CollateralUpdate for long position')
  }

  // Warning: Can throw if option isn't live
  const option = market.liveOption(strikeId, isCall)

  const marketName = option.market().name
  const strikePrice = option.strike().strikePrice
  const marketAddress = option.market().address
  const expiryTimestamp = option.board().expiryTimestamp
  const isBaseCollateral = getIsBaseCollateral(update.args.position.optionType)

  // Use current spot price as estimate for recent collateral update
  const spotPrice = option.market().spotPrice
  const value = isBaseCollateral ? amount.mul(spotPrice).div(UNIT) : amount

  const timestamp = update.args.timestamp.toNumber()
  const owner = getPositionOwner(transfers, blockNumber)

  return {
    owner,
    source: DataSource.Log,
    timestamp,
    positionId,
    strikeId,
    transactionHash,
    marketAddress,
    expiryTimestamp,
    blockNumber,
    amount,
    value,
    marketName,
    strikePrice,
    isCall,
    isBaseCollateral,
    spotPrice,
  }
}
