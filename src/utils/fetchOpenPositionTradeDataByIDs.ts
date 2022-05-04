import { CollateralUpdateData } from '../collateral_update_event'
import { LyraMarketContractId, PositionUpdatedType } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { TradeEventData } from '../trade_event'
import fetchBlockTimestamps from './fetchBlockTimestamps'
import getCollateralUpdateDataFromEvent from './getCollateralUpdateDataFromEvent'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'
import getLyraMarketContract from './getLyraMarketContract'
import getTradeDataFromEvent from './getTradeDataFromEvent'

export default async function fetchOpenPositionTradeDataByIDs(
  lyra: Lyra,
  market: Market,
  positionIds: number[]
): Promise<{ positionId: number; trades: TradeEventData[]; collateralUpdates: CollateralUpdateData[] }[]> {
  const tokenContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  const marketContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionMarket)

  if (positionIds.length === 0) {
    return []
  }

  const [tradeEvents, updateEvents, transferEvents] = await Promise.all([
    marketContract.queryFilter(marketContract.filters.Trade(null, null, positionIds)),
    tokenContract.queryFilter(tokenContract.filters.PositionUpdated(positionIds, null, PositionUpdatedType.Adjusted)),
    tokenContract.queryFilter(tokenContract.filters.Transfer(null, null, positionIds)),
  ])

  const blockTimestamps = await fetchBlockTimestamps(
    lyra,
    Array.from(new Set([...tradeEvents, ...updateEvents, ...transferEvents].map(e => e.blockNumber)))
  )

  return await Promise.all(
    positionIds.map(async positionId => {
      if (tradeEvents.length === 0) {
        return {
          positionId,
          trades: [],
          collateralUpdates: [],
        }
      }
      const firstTrade = tradeEvents[0]
      const isLong = getIsLong(firstTrade.args.trade.optionType)
      return {
        positionId,
        trades: tradeEvents
          // Filter out collateral update trades
          .filter(t => t.args.tradeResults.length > 0)
          .map(tradeEvent =>
            getTradeDataFromEvent(market, tradeEvent, transferEvents, blockTimestamps[tradeEvent.blockNumber] ?? 0)
          ),
        collateralUpdates: !isLong
          ? updateEvents.map(updateEvent =>
              getCollateralUpdateDataFromEvent(
                // Will throw if option is expired
                market.liveOption(
                  updateEvent.args.position.strikeId.toNumber(),
                  getIsCall(updateEvent.args.position.optionType)
                ),
                updateEvent,
                transferEvents,
                blockTimestamps[updateEvent.blockNumber] ?? 0
              )
            )
          : [],
      }
    })
  )
}
