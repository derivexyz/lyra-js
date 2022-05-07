import { CollateralUpdateData } from '../collateral_update_event'
import { DataSource } from '../constants/contracts'
import Lyra from '../lyra'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import fetchClosedPositionDataByOwner from './fetchClosedPositionDataByOwner'
import fetchOpenPositionDataByOwner from './fetchOpenPositionDataByOwner'
import getUniqueBy from './getUniqueBy'

export default async function fetchPositionDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<
  { position: PositionData; trades: TradeEventData[]; collateralUpdates: CollateralUpdateData[]; source: DataSource }[]
> {
  // Fetch open positions from contracts (realtime), closed positions from subgraph (historical)
  // fetchOpen/Closed filters out position IDs which are not open/closed respectively
  const [openPositions, closedPositions] = await Promise.all([
    fetchOpenPositionDataByOwner(lyra, owner),
    fetchClosedPositionDataByOwner(lyra, owner),
  ])
  const positions = openPositions
    .map(p => ({ ...p, source: DataSource.ContractCall }))
    .concat(closedPositions.map(p => ({ ...p, source: DataSource.Subgraph })))
  // Remove duplicates
  return getUniqueBy(positions, p => p.position.id)
}
