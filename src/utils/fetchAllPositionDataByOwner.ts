import { gql } from '@apollo/client/core'
import { getAddress } from '@ethersproject/address'

import { POSITION_QUERY_FRAGMENT, PositionQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import filterNulls from './filterNulls'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getPositionDataFromSubgraph from './getPositionDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'
import getUniqueBy from './getUniqueBy'
import subgraphRequest from './subgraphRequest'

// TODO: @dappbeast Handle more than 1k position queries
const positionsQuery = gql`
  query positions($owner: String) {
    # Get all positions that have been transferred to $owner
    optionTransfers(first: 1000, where:{newOwner: $owner}) {
      position {
        ${POSITION_QUERY_FRAGMENT}
      }
    }
    # Get all positions that have been traded by $owner
    # This covers any positions a trader opened as well as collateral updates
    trades(first: 1000, where:{trader:$owner}) {
      position {
        ${POSITION_QUERY_FRAGMENT}
      }
    }
  }
`

type PositionVariables = {
  owner: string
}

export default async function fetchAllPositionDataByOwner(lyra: Lyra, owner: string): Promise<PositionData[]> {
  const [{ data }, markets] = await Promise.all([
    subgraphRequest<
      {
        optionTransfers: { position: PositionQueryResult }[]
        trades: { position: PositionQueryResult }[]
      },
      PositionVariables
    >(lyra.subgraphClient, {
      query: positionsQuery,
      variables: {
        owner: owner.toLowerCase(),
      },
    }),
    lyra.markets(),
  ])

  const transferPositions = data?.optionTransfers.map(t => t.position) ?? []
  const tradedPositions = data?.trades.map(t => t.position) ?? []
  const positions = getUniqueBy(tradedPositions.concat(transferPositions), p => p.id)

  const marketsByAddress: Record<string, Market> = markets.reduce(
    (dict, market) => ({ ...dict, [market.address]: market }),
    {} as Record<string, Market>
  )

  return filterNulls(
    positions.map(pos => {
      const market = marketsByAddress[getAddress(pos.market.id)]
      if (!market) {
        // Handle positions from previous versions
        return null
      }
      const trades = pos.trades.map(getTradeDataFromSubgraph)
      const collateralUpdates = pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
      const transfers = pos.transfers.map(getTransferDataFromSubgraph)
      const settle = pos.settle ? getSettleDataFromSubgraph(pos.settle) : null
      return getPositionDataFromSubgraph(pos, market, trades, collateralUpdates, transfers, settle)
    })
  )
}
