import { BigNumber } from '@ethersproject/bignumber'
import { gql } from 'graphql-request'

import { CollateralUpdateData } from '../collateral_update_event'
import {
  COLLATERAL_UPDATE_QUERY_FRAGMENT,
  CollateralUpdateQueryResult,
  META_QUERY,
  MetaQueryResult,
  SETTLE_QUERY_FRAGMENT,
  SettleQueryResult,
  TRADE_QUERY_FRAGMENT,
  TradeQueryResult,
} from '../constants/queries'
import Lyra from '../lyra'
import { SettleEventData } from '../settle_event'
import { TradeEventData } from '../trade_event'
import { TransferEvent } from '../transfer_event'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
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
    settles(first: 1000, orderBy: timestamp, orderDirection: desc, where: { owner: $trader }) {
      ${SETTLE_QUERY_FRAGMENT}
    }
  }
`

type TradeVariables = {
  trader: string
}

export default async function fetchPositionEventsByOwner(
  lyra: Lyra,
  owner: string
): Promise<{
  trades: TradeEventData[]
  collateralUpdates: CollateralUpdateData[]
  transfers: TransferEvent[]
  settles: SettleEventData[]
}> {
  const res = await lyra.subgraphClient.request<
    {
      trades: TradeQueryResult[]
      collateralUpdates: CollateralUpdateQueryResult[]
      settles: SettleQueryResult[]
      _meta: MetaQueryResult
    },
    TradeVariables
  >(tradesQuery, {
    trader: owner.toLowerCase(),
  })
  return {
    trades: res.trades.filter(t => BigNumber.from(t.size).gt(0)).map(getTradeDataFromSubgraph),
    collateralUpdates: res.collateralUpdates.map(getCollateralUpdateDataFromSubgraph),
    settles: res.settles.map(getSettleDataFromSubgraph),
    transfers: [], // TODO: @earthtojake Account for transfers in subgraph
  }
}
