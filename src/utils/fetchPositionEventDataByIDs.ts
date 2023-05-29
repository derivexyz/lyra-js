import { gql } from '@apollo/client/core'

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
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'
import subgraphRequest from './subgraphRequest'

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

type PositionInputData = {
  marketAddress: string
  positionId: number
}

export default async function fetchPositionEventDataByIDs(
  lyra: Lyra,
  positionIds: PositionInputData[]
): Promise<Record<string, Record<number, PositionEventData>>> {
  const subgraphData = await subgraphRequest<
    {
      trades: TradeQueryResult[]
      collateralUpdates: CollateralUpdateQueryResult[]
      settles: SettleQueryResult[]
      optionTransfers: TransferQueryResult[]
    },
    {
      positionIds: string[]
    }
  >(lyra.subgraphClient, {
    query: positionEventsQuery,
    variables: {
      positionIds: positionIds.map(({ positionId, marketAddress }) => `${marketAddress.toLowerCase()}-${positionId}`),
    },
  })

  const eventsByMarketByPositionID: Record<string, Record<number, PositionEventData>> = positionIds.reduce(
    (dict, { positionId, marketAddress }) => ({
      ...dict,
      [marketAddress]: {
        [positionId]: { trades: [], collateralUpdates: [], transfers: [], settle: null },
        ...dict[marketAddress],
      },
    }),
    {} as Record<string, Record<number, PositionEventData>>
  )

  // Initialise with subgraph values
  const trades = subgraphData.data?.trades.map(getTradeDataFromSubgraph) ?? []
  const collateralUpdates = subgraphData.data?.collateralUpdates.map(getCollateralUpdateDataFromSubgraph) ?? []
  const transfers = subgraphData.data?.optionTransfers.map(getTransferDataFromSubgraph) ?? []
  const settles = subgraphData.data?.settles.map(getSettleDataFromSubgraph) ?? []
  trades.forEach(trade => {
    eventsByMarketByPositionID[trade.marketAddress][trade.positionId].trades.push(trade)
  })
  collateralUpdates.forEach(collateralUpdate => {
    eventsByMarketByPositionID[collateralUpdate.marketAddress][collateralUpdate.positionId].collateralUpdates.push(
      collateralUpdate
    )
  })
  transfers.forEach(transfer => {
    eventsByMarketByPositionID[transfer.marketAddress][transfer.positionId].transfers.push(transfer)
  })
  settles.forEach(settle => {
    eventsByMarketByPositionID[settle.marketAddress][settle.positionId].settle = settle
  })

  return eventsByMarketByPositionID
}
