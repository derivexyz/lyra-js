import { gql } from '@apollo/client/core'

import { LyraMarketContractId } from '../constants/contracts'
import { POSITION_QUERY_FRAGMENT } from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import fetchPositionEventDataByIDs from './fetchPositionEventDataByIDs'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getIsCall from './getIsCall'
import getLyraMarketContract from './getLyraMarketContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'
import getPositionDataFromSubgraph from './getPositionDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'

const positionsQuery = gql`
  query positions($positionId: Int!, $market: String!) {
    positions(first: 1, orderBy: openTimestamp, orderDirection: asc, where: { 
      positionId: $positionId, 
      market: $market,
    }) {
      ${POSITION_QUERY_FRAGMENT}
    }
  }
`

export default async function fetchPositionDataByID(
  lyra: Lyra,
  market: Market,
  positionId: number
): Promise<PositionData> {
  const optionToken = getLyraMarketContract(
    lyra,
    market.contractAddresses,
    lyra.version,
    LyraMarketContractId.OptionToken
  )
  try {
    const [positionWithOwnerStruct, eventsByPositionID] = await Promise.all([
      optionToken.getPositionWithOwner(positionId),
      fetchPositionEventDataByIDs(lyra, market, [positionId]),
    ])
    const { trades, transfers, collateralUpdates, settle } = eventsByPositionID[positionId]
    const strikeId = positionWithOwnerStruct.strikeId.toNumber()
    const isCall = getIsCall(positionWithOwnerStruct.optionType)
    const option = market.liveOption(strikeId, isCall)
    return getOpenPositionDataFromStruct(
      positionWithOwnerStruct.owner,
      positionWithOwnerStruct,
      option,
      trades,
      collateralUpdates,
      transfers,
      settle
    )
  } catch (e) {
    const { data } = await lyra.subgraphClient.query({
      query: positionsQuery,
      variables: {
        positionId,
        market: market.address.toLowerCase(),
      },
    })
    const pos = data.positions[0]
    const trades = pos.trades.map(getTradeDataFromSubgraph)
    const collateralUpdates = pos.collateralUpdates.map(getCollateralUpdateDataFromSubgraph)
    const transfers = pos.transfers.map(getTransferDataFromSubgraph)
    const settle = pos.settle ? getSettleDataFromSubgraph(pos.settle) : null
    return getPositionDataFromSubgraph(pos, market, trades, collateralUpdates, transfers, settle)
  }
}
