import { CollateralUpdateData } from '../collateral_update_event'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import fetchTradeEventDataByPositionIDs from './fetchOpenPositionTradeDataByIDs'

export default async function fetchOpenPositionTradeData(
  lyra: Lyra,
  market: Market,
  positions: PositionData[]
): Promise<{ position: PositionData; trades: TradeEventData[]; collateralUpdates: CollateralUpdateData[] }[]> {
  const positionIds = Array.from(new Set(positions.map(p => p.id)))
  const tradeEventData = await fetchTradeEventDataByPositionIDs(lyra, market, positionIds)
  return tradeEventData.map(({ positionId, trades, collateralUpdates }) => {
    const position = positions.find(p => p.id === positionId)
    if (!position) {
      throw new Error('Failed to find position')
    }
    return {
      position,
      trades,
      collateralUpdates,
    }
  })
}
