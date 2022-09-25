import { gql } from 'graphql-request'

import { PositionEventData } from '../constants/events'
import {
  COLLATERAL_UPDATE_QUERY_FRAGMENT,
  CollateralUpdateQueryResult,
  SETTLE_QUERY_FRAGMENT,
  SettleQueryResult,
  TRADE_QUERY_FRAGMENT,
  TradeQueryResult,
  TRANSFER_QUERY_FRAGMENT,
  TransferQueryResult,
} from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import fetchRecentPositionEventsByIDs from './fetchRecentPositionEventsByIDs'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'
import getUniqueBy from './getUniqueBy'

// TODO: @dappbeast Handle more than 1k trade queries
const positionEventsQuery = gql`
  query positionEvents($positionIds: [String!]!) {
    trades(first: 1000, orderBy: timestamp, orderDirection: asc, where: { position_in: $positionIds }) {
      ${TRADE_QUERY_FRAGMENT}
    }
    collateralUpdates(first: 1000, orderBy: timestamp, orderDirection: asc, where: { position_in: $positionIds }) {
      ${COLLATERAL_UPDATE_QUERY_FRAGMENT}
    }
    settles(first: 1000, orderBy: timestamp, orderDirection: asc, where: { position_in: $positionIds }) {
      ${SETTLE_QUERY_FRAGMENT}
    }
    optionTransfers(first: 1000, orderBy: timestamp, orderDirection: asc, where: { position_in: $positionIds }) {
      ${TRANSFER_QUERY_FRAGMENT}
    }
  }
`

export default async function fetchPositionEventDataByIDs(
  lyra: Lyra,
  market: Market,
  positionIds: number[]
): Promise<Record<number, PositionEventData>> {
  const [subgraphData, recentContractEvents] = await Promise.all([
    lyra.subgraphClient.request<
      {
        trades: TradeQueryResult[]
        collateralUpdates: CollateralUpdateQueryResult[]
        settles: SettleQueryResult[]
        optionTransfers: TransferQueryResult[]
      },
      {
        positionIds: string[]
      }
    >(positionEventsQuery, {
      positionIds: positionIds.map(pid => `${market.address.toLowerCase()}-${pid}`),
    }),
    fetchRecentPositionEventsByIDs(lyra, market, positionIds),
  ])

  const trades = subgraphData.trades.map(getTradeDataFromSubgraph)
  const collateralUpdates = subgraphData.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
  const transfers = subgraphData.optionTransfers.map(getTransferDataFromSubgraph)
  const settles = subgraphData.settles.map(getSettleDataFromSubgraph)

  const eventsByPositionID: Record<number, PositionEventData> = positionIds.reduce(
    (dict, positionId) => ({
      ...dict,
      [positionId]: { trades: [], collateralUpdates: [], transfers: [], settle: null },
    }),
    {} as Record<number, PositionEventData>
  )

  trades.forEach(trade => {
    eventsByPositionID[trade.positionId].trades.push(trade)
  })
  collateralUpdates.forEach(collateralUpdate => {
    eventsByPositionID[collateralUpdate.positionId].collateralUpdates.push(collateralUpdate)
  })
  transfers.forEach(transfer => {
    eventsByPositionID[transfer.positionId].transfers.push(transfer)
  })
  settles.forEach(settle => {
    eventsByPositionID[settle.positionId].settle = settle
  })

  // Merge recent contract events with subgraph events
  Object.entries(recentContractEvents).map(([key, { trades, collateralUpdates }]) => {
    const positionId = parseInt(key)
    eventsByPositionID[positionId].trades = getUniqueBy(
      // Merge events by tx hash, prefer subgraph events
      [...eventsByPositionID[positionId].trades, ...trades],
      trade => trade.transactionHash
    )
    eventsByPositionID[positionId].collateralUpdates = getUniqueBy(
      // Merge events by tx hash, prefer subgraph events
      [...eventsByPositionID[positionId].collateralUpdates, ...collateralUpdates],
      update => update.transactionHash
    )
  })

  return eventsByPositionID
}
