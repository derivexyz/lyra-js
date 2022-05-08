import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import { CollateralUpdateData } from '../collateral_update_event'
import { META_QUERY, MetaQueryResult, POSITION_QUERY_FRAGMENT, PositionQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import getClosedPositionDataFromSubgraph from './getClosedPositionDataFromSubgraph'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'

// TODO: @earthtojake Handle more than 1k position queries
const positionsQuery = gql`
  query positions($ids: [String]) {
    ${META_QUERY}
    positions(first: 1000, orderBy: openTimestamp, orderDirection: desc, where: { id_in: $ids, state_gt: 1 }) {
      ${POSITION_QUERY_FRAGMENT}
    }
  }
`

type PositionVariables = {
  ids: string[]
}

export default async function fetchClosedPositionDataByIDs(
  lyra: Lyra,
  market: Market,
  positionIds: number[]
): Promise<
  {
    position: PositionData
    trades: TradeEventData[]
    collateralUpdates: CollateralUpdateData[]
  }[]
> {
  const res = await lyra.subgraphClient.request<
    { positions: PositionQueryResult[]; _meta: MetaQueryResult },
    PositionVariables
  >(positionsQuery, {
    ids: positionIds.map(id => `${market.address.toLowerCase()}-${id.toString()}`),
  })
  return res.positions.map(pos => {
    return {
      position: getClosedPositionDataFromSubgraph(pos, res._meta.block.number),
      trades: pos.trades.filter(t => BigNumber.from(t.size).gt(0)).map(getTradeDataFromSubgraph),
      collateralUpdates: pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph),
    }
  })
}
