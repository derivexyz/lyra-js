import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import fetchPositionEventDataByIDs from './fetchPositionEventDataByIDs'
import getIsCall from './getIsCall'
import getLyraContract from './getLyraContract'
import getOpenPositionDataFromStruct from './getOpenPositionDataFromStruct'

export default async function fetchOpenPositionDataByOwner(
  lyra: Lyra,
  owner: string,
  markets: Market[]
): Promise<PositionData[]> {
  // Fetch all owner positions across all markets
  const positionsByMarketAddress = await getLyraContract(
    lyra.provider,
    lyra.deployment,
    LyraContractId.OptionMarketViewer
  ).getOwnerPositions(owner)

  const marketsByAddress: Record<string, Market> = markets.reduce(
    (dict, market) => ({ ...dict, [market.address]: market }),
    {} as Record<string, Market>
  )

  const positionStructsByMarket = positionsByMarketAddress.map(
    ({ positions: positionStructs, market: marketAddress }) => ({
      positionStructs,
      market: marketsByAddress[marketAddress],
    })
  )

  const positions = (
    await Promise.all(
      positionStructsByMarket.map(async ({ market, positionStructs }) => {
        const positionIds = positionStructs.map(p => p.positionId.toNumber())
        const eventsByPositionID = await fetchPositionEventDataByIDs(lyra, market, positionIds)
        return positionStructs.map(positionStruct => {
          const positionId = positionStruct.positionId.toNumber()
          const strikeId = positionStruct.strikeId.toNumber()
          const isCall = getIsCall(positionStruct.optionType)
          const { trades, collateralUpdates, transfers, settle } = eventsByPositionID[positionId]
          const option = market.liveOption(strikeId, isCall)
          return getOpenPositionDataFromStruct(
            owner,
            positionStruct,
            option,
            trades,
            collateralUpdates,
            transfers,
            settle
          )
        })
      })
    )
  ).flat()

  return positions
}
