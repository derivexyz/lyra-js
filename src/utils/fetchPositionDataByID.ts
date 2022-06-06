import { LyraMarketContractId } from '../constants/contracts'
import { PositionEventData } from '../constants/events'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import fetchPositionEventsByIDs from './fetchPositionEventsByIDs'
import getIsCall from './getIsCall'
import getLyraMarketContract from './getLyraMarketContract'
import getPositionDataFromStruct from './getPositionDataFromStruct'

export default async function fetchPositionDataByID(
  lyra: Lyra,
  market: Market,
  positionId: number
): Promise<
  {
    position: PositionData
  } & PositionEventData
> {
  const optionToken = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  const [positionStruct, [{ trades, collateralUpdates, transfers }]] = await Promise.all([
    optionToken.getOptionPosition(positionId),
    fetchPositionEventsByIDs(lyra, market, [positionId]),
  ])
  const option = await market.option(positionStruct.strikeId.toNumber(), getIsCall(positionStruct.optionType))
  const lastTransfer = transfers.length > 0 ? transfers[transfers.length - 1] : null
  const lastTrade = trades[trades.length - 1]
  const owner = lastTransfer ? lastTransfer.to : lastTrade.trader
  const position = getPositionDataFromStruct(owner, option, positionStruct)
  return {
    positionId: position.id,
    position,
    trades,
    collateralUpdates,
    transfers,
  }
}
