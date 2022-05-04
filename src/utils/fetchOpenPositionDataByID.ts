import Lyra from '..'
import { CollateralUpdateData } from '../collateral_update_event'
import { LyraMarketContractId } from '../constants/contracts'
import Market from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import fetchOpenPositionTradeData from './fetchOpenPositionTradeData'
import getIsCall from './getIsCall'
import getLyraMarketContract from './getLyraMarketContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'

export default async function fetchOpenPositionDataByID(
  lyra: Lyra,
  market: Market,
  positionId: number
): Promise<{ position: PositionData; trades: TradeEventData[]; collateralUpdates: CollateralUpdateData[] }> {
  const optionToken = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  try {
    const positionStruct = await optionToken.getPositionWithOwner(positionId)
    // Throws if option is not live (e.g. position is expired but not settled by a bot)
    const option = market.liveOption(positionStruct.strikeId.toNumber(), getIsCall(positionStruct.optionType))
    const positionData = getOpenPositionDataFromStruct(positionStruct.owner, option, positionStruct)
    return (await fetchOpenPositionTradeData(lyra, market, [positionData]))[0]
  } catch (_e) {
    throw new Error('Position is not open')
  }
}
