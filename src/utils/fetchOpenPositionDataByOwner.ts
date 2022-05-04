import Lyra from '..'
import { CollateralUpdateData } from '../collateral_update_event'
import { LyraContractId } from '../constants/contracts'
import Market from '../market'
import { PositionData } from '../position'
import { TradeEventData } from '../trade_event'
import fetchOpenPositionTradeData from './fetchOpenPositionTradeData'
import filterNulls from './filterNulls'
import getIsCall from './getIsCall'
import getLyraContract from './getLyraContract'
import getPositionDataFromStruct from './getOpenPositionDataFromStruct'

export default async function fetchOpenPositionDataByOwner(
  lyra: Lyra,
  owner: string
): Promise<{ position: PositionData; trades: TradeEventData[]; collateralUpdates: CollateralUpdateData[] }[]> {
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
        // TODO: @earthtojake Parallelize trade fetching across markets
        return await fetchOpenPositionTradeData(lyra, market, positionDatas)
      })
    )
  ).flat()
}
