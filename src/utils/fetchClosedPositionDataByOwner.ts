import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { CollateralUpdateData } from '../collateral_update_event'
import { META_QUERY, MetaQueryResult, POSITION_QUERY_FRAGMENT, PositionQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import getClosedPositionDataFromSubgraph from './getClosedPositionDataFromSubgraph'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'

// TODO: @earthtojake Handle more than 1k position queries
const positionsQuery = gql`
  query positions($owner: String) {
    ${META_QUERY}
    positions(first: 1000, orderBy: openTimestamp, orderDirection: desc, where: { owner: $owner, state_gt: 1 }) {
      ${POSITION_QUERY_FRAGMENT}
    }
  }
`

type PositionVariables = {
  owner: string
}

export default async function fetchClosedPositionDataByOwner(
  lyra: Lyra,
  owner: string
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
    owner: owner.toLowerCase(),
  })
  return res.positions.map(pos => {
    return {
      position: getClosedPositionDataFromSubgraph(pos, res._meta.block.number),
      trades: pos.trades.filter(t => BigNumber.from(t.size).gt(0)).map(getTradeDataFromSubgraph),
      collateralUpdates: pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph),
    }
  })
}
