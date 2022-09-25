import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import fetchPositionEventDataByIDs from './fetchPositionEventDataByIDs'
import getIsCall from './getIsCall'
import getLyraMarketContract from './getLyraMarketContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'

export default async function fetchPositionDataByID(
  lyra: Lyra,
  market: Market,
  positionId: number
): Promise<PositionData> {
  const optionToken = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  const [positionStruct, eventsByPositionID] = await Promise.all([
    optionToken.getOptionPosition(positionId),
    fetchPositionEventDataByIDs(lyra, market, [positionId]),
  ])
  const { trades, transfers, collateralUpdates, settle } = eventsByPositionID[positionId]
  const strikeId = positionStruct.strikeId.toNumber()
  const isCall = getIsCall(positionStruct.optionType)
  const option = await market.option(strikeId, isCall)
  return getOpenPositionDataFromStruct(positionStruct, option, trades, collateralUpdates, transfers, settle)
}
