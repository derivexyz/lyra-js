import { getAddress } from '@ethersproject/address'
import { gql } from 'graphql-request'

import {
  MAX_END_TIMESTAMP,
  MIN_START_TIMESTAMP,
  POSITION_QUERY_FRAGMENT,
  PositionQueryResult,
} from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData, PositionFilter } from '../position'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getPositionDataFromSubgraph from './getPositionDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'
import subgraphRequestWithLoop from './subgraphRequestWithLoop'

const positionsQuery = gql`
  query positions($max: Int!, $min: Int!, $market: String!) {
    positions(first: 1000, orderBy: openTimestamp, orderDirection: asc, where: { 
      positionId_gte: $min, 
      positionId_lte: $max,
      market: $market,
    }) {
      ${POSITION_QUERY_FRAGMENT}
    }
  }
`

export default async function fetchAllPositionData(lyra: Lyra, filter?: PositionFilter): Promise<PositionData[]> {
  let markets: Market[]
  if (filter?.markets) {
    markets = await Promise.all(filter.markets.map(market => lyra.market(market)))
  } else {
    markets = await lyra.markets()
  }
  const data = await Promise.all(
    markets.map(market => {
      const minIds = filter?.minPositionIds ?? {}
      const maxids = filter?.maxPositionIds ?? {}
      const minKey =
        Object.keys(minIds).find(
          id => id.toLowerCase() === market.address.toLowerCase() || id.toLowerCase() === market.name.toLowerCase()
        ) ?? ''
      const maxKey =
        Object.keys(maxids).find(
          id => id.toLowerCase() === market.address.toLowerCase() || id.toLowerCase() === market.name.toLowerCase()
        ) ?? ''
      const min = minIds[minKey] ?? 0
      const max = maxids[maxKey] ?? 0
      return subgraphRequestWithLoop<PositionQueryResult>(
        lyra,
        positionsQuery,
        { min, max, market: market.address.toLowerCase() },
        'positionId',
        {
          increment: 1000,
          batch: 5,
        }
      )
    })
  )

  const marketsByAddress: Record<string, Market> = markets.reduce(
    (dict, market) => ({ ...dict, [market.address]: market }),
    {} as Record<string, Market>
  )

  const minOpenTimestamp = filter?.minOpenTimestamp ?? MIN_START_TIMESTAMP
  const maxCloseTimestamp = filter?.maxCloseTimestamp ?? MAX_END_TIMESTAMP

  const positions = data
    .flat()
    .filter(pos => pos.openTimestamp >= minOpenTimestamp && pos.closeTimestamp <= maxCloseTimestamp)
    .map(pos => {
      const trades = pos.trades.map(getTradeDataFromSubgraph)
      const collateralUpdates = pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
      const transfers = pos.transfers.map(getTransferDataFromSubgraph)
      const settle = pos.settle ? getSettleDataFromSubgraph(pos.settle) : null
      const market = marketsByAddress[getAddress(pos.market.id)]
      return getPositionDataFromSubgraph(pos, market, trades, collateralUpdates, transfers, settle)
    })

  return positions
}
