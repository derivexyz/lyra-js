import { CollateralUpdateData } from '../collateral_update_event'
import { LyraMarketContractId, PositionUpdatedType } from '../constants/contracts'
import { TradeEvent } from '../contracts/typechain/OptionMarket'
import { PositionUpdatedEvent } from '../contracts/typechain/OptionToken'
import Lyra from '../lyra'
import { Market } from '../market'
import { TradeEventData } from '../trade_event'
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

  // TODO: @earthtojake Batch event fetching across multiple markets
  const [tradeEvents, updateEvents] = await Promise.all([
    marketContract.queryFilter(marketContract.filters.Trade(null, null, positionIds)),
    tokenContract.queryFilter(
      tokenContract.filters.PositionUpdated(positionIds, null, [
        PositionUpdatedType.Adjusted,
        PositionUpdatedType.Closed,
        PositionUpdatedType.Liquidated,
        PositionUpdatedType.Opened,
        PositionUpdatedType.Settled,
        PositionUpdatedType.Merged,
        PositionUpdatedType.MergedInto,
        PositionUpdatedType.SplitFrom,
        PositionUpdatedType.SplitInto,
      ])
    ),
  ])

  const positionEvents: Record<number, { trades: TradeEvent[]; updates: PositionUpdatedEvent[] }> = {}
  tradeEvents.forEach(tradeEvent => {
    const positionId = tradeEvent.args.positionId.toNumber()
    if (!positionEvents[positionId]) {
      positionEvents[positionId] = { trades: [], updates: [] }
    }
    positionEvents[positionId].trades.push(tradeEvent)
  })
  updateEvents.forEach(updateEvent => {
    const positionId = updateEvent.args.positionId.toNumber()
    if (!positionEvents[positionId]) {
      positionEvents[positionId] = { trades: [], updates: [] }
    }
    positionEvents[positionId].updates.push(updateEvent)
  })

  return await Promise.all(
    positionIds.map(async positionId => {
      const { trades, updates } = positionEvents[positionId]
      const firstTrade = tradeEvents[0]
      if (!firstTrade) {
        return {
          positionId,
          trades: [],
          collateralUpdates: [],
        }
      }
      // Will throw if option is expired
      const option = market.liveOption(firstTrade.args.strikeId.toNumber(), getIsCall(firstTrade.args.trade.optionType))
      const isLong = getIsLong(firstTrade.args.trade.optionType)
      return {
        positionId,
        trades: trades
          // Filter out collateral adjustments
          .filter(t => t.args.tradeResults.length > 0)
          .map(tradeEvent => {
            const updateEventsForHash = updateEvents.filter(u => u.transactionHash === tradeEvent.transactionHash)
            return getTradeDataFromEvent(market, tradeEvent, updateEventsForHash)
          }),
        collateralUpdates: !isLong
          ? updates.map(updateEvent => {
              const updateEventsForHash = updateEvents.filter(u => u.transactionHash === updateEvent.transactionHash)
              return getCollateralUpdateDataFromEvent(option, updateEventsForHash)
            })
          : [],
      }
    })
  )
}
