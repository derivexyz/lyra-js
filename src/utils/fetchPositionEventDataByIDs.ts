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
  const [subgraphDataResult, recentContractEventsResult] = await Promise.allSettled([
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

  const eventsByPositionID: Record<number, PositionEventData> = positionIds.reduce(
    (dict, positionId) => ({
      ...dict,
      [positionId]: { trades: [], collateralUpdates: [], transfers: [], settle: null },
    }),
    {} as Record<number, PositionEventData>
  )

  if (subgraphDataResult.status === 'fulfilled') {
    // Initialise with subgraph values
    const trades = subgraphDataResult.value.trades.map(getTradeDataFromSubgraph)
    const collateralUpdates = subgraphDataResult.value.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
    const transfers = subgraphDataResult.value.optionTransfers.map(getTransferDataFromSubgraph)
    const settles = subgraphDataResult.value.settles.map(getSettleDataFromSubgraph)
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
  } else {
    console.error(subgraphDataResult.reason)
  }

  // Contract call failure
  if (recentContractEventsResult.status !== 'fulfilled') {
    throw new Error(recentContractEventsResult.reason)
  }

  // Merge recent contract events with subgraph events
  Object.entries(recentContractEventsResult.value).map(([key, { trades, collateralUpdates }]) => {
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
