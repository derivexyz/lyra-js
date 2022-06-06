import { DataSource } from '../constants/contracts'
import { PositionEventData } from '../constants/events'
import Lyra from '../lyra'
import { PositionData } from '../position'
import fetchHistoricalPositionDataByOwner from './fetchHistoricalPositionDataByOwner'
import fetchOpenPositionDataByOwner from './fetchOpenPositionDataByOwner'
import getUniqueBy from './getUniqueBy'

export default async function fetchPositionDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<
  ({
    position: PositionData
    source: DataSource
  } & PositionEventData)[]
> {
  const [openPositions, closedPositions] = await Promise.all([
    fetchOpenPositionDataByOwner(lyra, owner),
    fetchHistoricalPositionDataByOwner(lyra, owner),
  ])
  const positions = openPositions
    .map(p => ({ ...p, source: DataSource.ContractCall, positionId: p.position.id }))
    .concat(closedPositions.map(p => ({ ...p, source: DataSource.Subgraph, positionId: p.position.id })))
  // Remove duplicates, prefer open positions
  return getUniqueBy(positions, p => p.positionId)
}
