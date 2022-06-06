import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import { CollateralUpdateData } from '../collateral_update_event'
import { META_QUERY, MetaQueryResult, POSITION_QUERY_FRAGMENT, PositionQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getPositionDataFromSubgraph from './getPositionDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getUniqueBy from './getUniqueBy'

// TODO: @earthtojake Handle more than 1k position queries
const positionsQuery = gql`
  query positions($owner: String) {
    ${META_QUERY}
    # Get all positions that have been transferred to $owner
    optionTransfers(first: 1000, orderBy: timestamp, orderDirection: desc, where:{newOwner: $owner}) {
      position {
        ${POSITION_QUERY_FRAGMENT}
      }
    }
    # Get all positions that have been traded by $owner
    # This covers any positions a trader opened as well as collateral updates
    trades(first: 1000, orderBy: timestamp, orderDirection: desc, where:{trader:$owner}) {
      position {
        ${POSITION_QUERY_FRAGMENT}
      }
    }
  }
`

type PositionVariables = {
  owner: string
}

// Fetches all historical positions owned by a user
export default async function fetchHistoricalPositionDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<
  {
    position: PositionData
    trades: TradeEventData[]
    collateralUpdates: CollateralUpdateData[]
    transfers: TransferEventData[]
  }[]
> {
  const res = await lyra.subgraphClient.request<
    {
      optionTransfers: { position: PositionQueryResult }[]
      trades: { position: PositionQueryResult }[]
      _meta: MetaQueryResult
    },
    PositionVariables
  >(positionsQuery, {
    owner: owner.toLowerCase(),
  })

  const transferPositions = res.optionTransfers.map(t => t.position)
  const tradedPositions = res.trades.map(t => t.position)
  const positions = getUniqueBy(tradedPositions.concat(transferPositions), p => p.id)

  return positions.map(pos => {
    return {
      position: getPositionDataFromSubgraph(pos, res._meta.block.number),
      trades: pos.trades.filter(t => BigNumber.from(t.size).gt(0)).map(getTradeDataFromSubgraph),
      collateralUpdates: pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph),
      transfers: [], // TODO: @earthtojake Fix transfer events from subgraph
    }
  })
}
