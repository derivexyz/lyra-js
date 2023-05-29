import { gql } from '@apollo/client/core'

import { LyraMarketContractId } from '../constants/contracts'
import { POSITION_QUERY_FRAGMENT, PositionQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import getCollateralUpdateDataFromSubgraph from './getCollateralUpdateDataFromSubgraph'
import getIsCall from './getIsCall'
import getLyraMarketContract from './getLyraMarketContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'
import getPositionDataFromSubgraph from './getPositionDataFromSubgraph'
import getSettleDataFromSubgraph from './getSettleDataFromSubgraph'
import getTradeDataFromSubgraph from './getTradeDataFromSubgraph'
import getTransferDataFromSubgraph from './getTransferDataFromSubgraph'
import subgraphRequest from './subgraphRequest'

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

  const [structPromise, subgraphPromise] = await Promise.allSettled([
    optionToken.getPositionWithOwner(positionId),
    subgraphRequest<{ positions: PositionQueryResult[] }>(lyra.subgraphClient, {
      query: positionsQuery,
      variables: {
        positionId,
        market: market.address.toLowerCase(),
      },
    }),
  ])

  const openPositionStruct = structPromise.status === 'fulfilled' ? structPromise.value : null
  const subgraphData = subgraphPromise.status === 'fulfilled' ? subgraphPromise.value : null

  // Subgraph may not have synced trade event
  const subgraphPositionData = subgraphData?.data?.positions[0]
  const trades = subgraphPositionData?.trades.map(getTradeDataFromSubgraph) ?? []
  const collateralUpdates = subgraphPositionData?.collateralUpdates.map(getCollateralUpdateDataFromSubgraph) ?? []
  const transfers = subgraphPositionData?.transfers.map(getTransferDataFromSubgraph) ?? []
  const settle = subgraphPositionData?.settle ? getSettleDataFromSubgraph(subgraphPositionData.settle) : null

  if (openPositionStruct) {
    const strikeId = openPositionStruct.strikeId.toNumber()
    const isCall = getIsCall(openPositionStruct.optionType)
    const option = market.liveOption(strikeId, isCall)
    return getOpenPositionDataFromStruct(
      openPositionStruct.owner,
      openPositionStruct,
      option,
      trades,
      collateralUpdates,
      transfers,
      settle
    )
  } else if (subgraphPositionData) {
    return getPositionDataFromSubgraph(subgraphPositionData, market, trades, collateralUpdates, transfers, settle)
  } else {
    // Should never happen
    // An open position should always have state and closed position should always have subgraph data
    throw new Error('Failed to fetch position')
  }
}
