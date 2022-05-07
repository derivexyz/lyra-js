import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import { CollateralUpdateData } from '../collateral_update_event'
import {
  COLLATERAL_UPDATE_QUERY_FRAGMENT,
  CollateralUpdateQueryResult,
  META_QUERY,
  MetaQueryResult,
  TRADE_QUERY_FRAGMENT,
  TradeQueryResult,
} from '../constants/queries'
import Lyra from '../lyra'
import { TradeEventData } from '../trade_event'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'

// TODO: @earthtojake Handle more than 1k trade queries
const tradesQuery = gql`
  query trades($trader: String) {
    ${META_QUERY}
    trades(first: 1000, orderBy: timestamp, orderDirection: desc, where: { trader: $trader }) {
      ${TRADE_QUERY_FRAGMENT}
    }
    collateralUpdates(first: 1000, orderBy: timestamp, orderDirection: desc, where: { trader: $trader }) {
      ${COLLATERAL_UPDATE_QUERY_FRAGMENT}
    }
  }
`

type TradeVariables = {
  trader: string
}

export default async function fetchPositionTradeDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<{
  trades: TradeEventData[]
  collateralUpdates: CollateralUpdateData[]
}> {
  const res = await lyra.subgraphClient.request<
    {
      trades: TradeQueryResult[]
      collateralUpdates: CollateralUpdateQueryResult[]
      _meta: MetaQueryResult
    },
    TradeVariables
  >(tradesQuery, {
    trader: owner.toLowerCase(),
  })
  return {
    trades: res.trades.filter(t => BigNumber.from(t.size).gt(0)).map(getTradeDataFromSubgraph),
    collateralUpdates: res.collateralUpdates.map(getCollateralUpdateDataFromSubgraph),
  }
}
