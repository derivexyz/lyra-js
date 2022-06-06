import { CollateralUpdateData } from '../collateral_update_event'
import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'
import fetchPositionEventsByIDs from './fetchPositionEventsByIDs'
import filterNulls from './filterNulls'
import getIsCall from './getIsCall'
import getLyraContract from './getLyraContract'
import getPositionDataFromStruct from './getPositionDataFromStruct'

export default async function fetchOpenPositionDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<
  {
    position: PositionData
    trades: TradeEventData[]
    collateralUpdates: CollateralUpdateData[]
    transfers: TransferEventData[]
  }[]
> {
  // Fetch all owner positions across all markets
  const positionsByMarketAddress = await getLyraContract(
    lyra.provider,
    lyra.deployment,
    LyraContractId.OptionMarketViewer
  ).getOwnerPositions(owner)
  // Fetch open position market data
  const markets = await Market.getMany(
    lyra,
    positionsByMarketAddress.map(({ market }) => market)
  )
  const positionsByMarket = positionsByMarketAddress.map(({ positions }, idx) => ({
    positions,
    market: markets[idx],
  }))
  // Fetch historical data for each open position
  return (
    await Promise.all(
      positionsByMarket.map(async ({ market, positions }) => {
        const positionDatas = filterNulls(
          positions.map(positionStruct => {
            try {
              // Throws if option is not live (e.g. position is expired but not settled by a bot)
              const option = market.liveOption(positionStruct.strikeId.toNumber(), getIsCall(positionStruct.optionType))
              // TODO: @earthtojake Handle gas limits with a fallback
              return getPositionDataFromStruct(owner, option, positionStruct)
            } catch (e) {
              return null
            }
          })
        )
        const positionIds = Array.from(new Set(positionDatas.map(p => p.id)))
        // TODO: @earthtojake Parallelize trade fetching across markets
        const positionTradeData = await fetchPositionEventsByIDs(lyra, market, positionIds)

        // Map of position IDs to position datas
        const positionMap: Record<number, PositionData> = {}
        positionDatas.forEach(position => {
          positionMap[position.id] = position
        })

        return positionTradeData.map(({ positionId, trades, collateralUpdates, transfers }) => {
          return {
            position: positionMap[positionId],
            trades,
            collateralUpdates,
            transfers,
          }
        })
      })
    )
  ).flat()
}
