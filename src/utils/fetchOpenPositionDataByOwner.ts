import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import fetchPositionEventDataByIDs from './fetchPositionEventDataByIDs'
import getIsCall from './getIsCall'
import getLyraContract from './getLyraContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'

export default async function fetchOpenPositionDataByOwner(lyra: Lyra, owner: string): Promise<PositionData[]> {
  // Fetch all owner positions across all markets
  const positionsByMarketAddress = await getLyraContract(
    lyra,
    lyra.version,
    LyraContractId.OptionMarketViewer
  ).getOwnerPositions(owner)

  const positionIds = positionsByMarketAddress.flatMap(({ market, positions }) =>
    positions.map(position => ({ positionId: position.positionId.toNumber(), marketAddress: market }))
  )

  const [positionEventsDict, markets] = await Promise.all([
    fetchPositionEventDataByIDs(lyra, positionIds),
    lyra.markets(),
  ])

  const marketsByAddress: Record<string, Market> = markets.reduce(
    (dict, market) => ({ ...dict, [market.address]: market }),
    {} as Record<string, Market>
  )

  return positionsByMarketAddress.flatMap(({ positions: openPositionStructs, market: marketAddress }) => {
    return openPositionStructs.map(openPositionStruct => {
      const positionId = openPositionStruct.positionId.toNumber()

      const strikeId = openPositionStruct.strikeId.toNumber()
      const isCall = getIsCall(openPositionStruct.optionType)
      const { trades, collateralUpdates, transfers, settle } = positionEventsDict[marketAddress][positionId]
      const option = marketsByAddress[marketAddress].liveOption(strikeId, isCall)
      return getOpenPositionDataFromStruct(
        owner,
        openPositionStruct,
        option,
        trades,
        collateralUpdates,
        transfers,
        settle
      )
    })
  })
}
