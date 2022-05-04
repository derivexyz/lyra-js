import Lyra from '..'
import { CollateralUpdateData } from '../collateral_update_event'
import { DataSource } from '../constants/contracts'
import Market from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import fetchClosedPositionDataByIDs from './fetchClosedPositionDataByIDs'
import fetchOpenPositionDataByID from './fetchOpenPositionDataByID'

export default async function fetchPositionDataByID(
  lyra: Lyra,
  market: Market,
  positionId: number
): Promise<{
  position: PositionData
  trades: TradeEventData[]
  collateralUpdates: CollateralUpdateData[]
  source: DataSource
}> {
  try {
    // Fetch open positions from contracts (for realtime data)
    const position = await fetchOpenPositionDataByID(lyra, market, positionId)
    return {
      ...position,
      source: DataSource.ContractCall,
    }
  } catch (_e) {
    // Fetch closed positions from subgraph (for static data)
    const positions = await fetchClosedPositionDataByIDs(lyra, market, [positionId])
    if (positions.length === 0) {
      throw new Error('Position for ID does not exist')
    }
    return {
      ...positions[0],
      source: DataSource.Subgraph,
    }
  }
}
