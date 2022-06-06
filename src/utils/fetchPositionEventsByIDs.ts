import { LyraMarketContractId, POSITION_UPDATED_TYPES } from '../constants/contracts'
import { PositionEventData } from '../constants/events'
import { TradeEvent } from '../contracts/typechain/OptionMarket'
import { PositionUpdatedEvent, TransferEvent as ContractTransferEvent } from '../contracts/typechain/OptionToken'
import Lyra from '../lyra'
import { Market } from '../market'
import getCollateralUpdateDataFromEvent from './getCollateralUpdateDataFromEvent'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'
import getLyraMarketContract from './getLyraMarketContract'
import getTradeDataFromEvent from './getTradeDataFromEvent'
import getTransferDataFromEvents from './getTransferDataFromEvents'

export default async function fetchPositionEventsByIDs(
  lyra: Lyra,
  market: Market,
  positionIds: number[]
): Promise<PositionEventData[]> {
  const tokenContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  const marketContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionMarket)

  if (positionIds.length === 0) {
    return []
  }

  // TODO: @earthtojake Batch event fetching across multiple markets
  const [tradeEvents, updateEvents, transferEvents] = await Promise.all([
    marketContract.queryFilter(marketContract.filters.Trade(null, null, positionIds)),
    // TODO: @earthtojake Remove PositionUpdated transfer events from contracts
    tokenContract.queryFilter(tokenContract.filters.PositionUpdated(positionIds, null, POSITION_UPDATED_TYPES)),
    tokenContract.queryFilter(tokenContract.filters.Transfer(null, null, positionIds)),
  ])

  const positionEvents: Record<
    number,
    { tradeEvents: TradeEvent[]; updateEvents: PositionUpdatedEvent[]; transferEvents: ContractTransferEvent[] }
  > = {}
  tradeEvents.forEach(tradeEvent => {
    const positionId = tradeEvent.args.positionId.toNumber()
    if (!positionEvents[positionId]) {
      positionEvents[positionId] = { tradeEvents: [], updateEvents: [], transferEvents: [] }
    }
    positionEvents[positionId].tradeEvents.push(tradeEvent)
  })
  updateEvents.forEach(updateEvent => {
    const positionId = updateEvent.args.positionId.toNumber()
    if (!positionEvents[positionId]) {
      positionEvents[positionId] = { tradeEvents: [], updateEvents: [], transferEvents: [] }
    }
    positionEvents[positionId].updateEvents.push(updateEvent)
  })
  transferEvents.forEach(transferEvent => {
    const positionId = transferEvent.args.tokenId.toNumber()
    if (!positionEvents[positionId]) {
      positionEvents[positionId] = { tradeEvents: [], updateEvents: [], transferEvents: [] }
    }
    positionEvents[positionId].transferEvents.push(transferEvent)
  })

  return await Promise.all(
    positionIds.map(async positionId => {
      if (!positionEvents[positionId]) {
        throw new Error('Position does not exist')
      }
      const { tradeEvents, updateEvents, transferEvents } = positionEvents[positionId]
      const firstTrade = tradeEvents[0] // Always defined

      // Only fetches for expired options
      const option = await market.option(
        firstTrade.args.strikeId.toNumber(),
        getIsCall(firstTrade.args.trade.optionType)
      )
      const isLong = getIsLong(firstTrade.args.trade.optionType)

      const transfers = getTransferDataFromEvents(transferEvents)

      const trades = tradeEvents
        // Filter out trades that are pure collateral adjustments
        .filter(t => t.args.tradeResults.length > 0)
        .map(tradeEvent => {
          return getTradeDataFromEvent(market, tradeEvent, transfers)
        })

      const collateralUpdates = !isLong
        ? // Get collateral updates for all short positions
          updateEvents.map(updateEvent => {
            return getCollateralUpdateDataFromEvent(updateEvent, option, transfers)
          })
        : []

      return {
        positionId,
        trades,
        collateralUpdates,
        transfers,
      }
    })
  )
}
