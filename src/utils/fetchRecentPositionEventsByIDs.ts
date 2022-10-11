import { LyraMarketContractId, POSITION_UPDATED_TYPES } from '../constants/contracts'
import { PositionEventData } from '../constants/events'
import { TransferEvent as ContractTransferEvent } from '../contracts/typechain/OptionToken'
import Lyra from '../lyra'
import { Market } from '../market'
import filterNulls from './filterNulls'
import getCollateralUpdateDataFromRecentEvent from './getCollateralUpdateDataFromRecentEvent'
import getLyraMarketContract from './getLyraMarketContract'
import getTradeDataFromRecentEvent from './getTradeDataFromRecentEvent'

const BLOCK_LIMIT = 100

type PositionRecentEventData = Omit<PositionEventData, 'settle' | 'transfers'>

const getTransferKey = (txHash: string, positionId: number) => `${txHash}-${positionId}`

export default async function fetchRecentPositionEventsByIDs(
  lyra: Lyra,
  market: Market,
  positionIds: number[]
): Promise<Record<number, PositionRecentEventData>> {
  const tokenContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionToken)
  const marketContract = getLyraMarketContract(lyra, market.contractAddresses, LyraMarketContractId.OptionMarket)

  if (positionIds.length === 0) {
    return []
  }

  // Approximately last 1 min of events
  const fromBlockNumber = market.block.number - BLOCK_LIMIT

  const [tradeEvents, updateEvents, transferEvents] = await Promise.all([
    marketContract.queryFilter(marketContract.filters.Trade(null, null, positionIds), fromBlockNumber),
    tokenContract.queryFilter(
      tokenContract.filters.PositionUpdated(positionIds, null, POSITION_UPDATED_TYPES),
      fromBlockNumber
    ),
    tokenContract.queryFilter(tokenContract.filters.Transfer(null, null, positionIds), fromBlockNumber),
  ])

  const transfersByIdAndHash: Record<string, ContractTransferEvent[]> = transferEvents.reduce((dict, transfer) => {
    const key = getTransferKey(transfer.transactionHash, transfer.args.tokenId.toNumber())
    return {
      ...dict,
      [key]: [...(dict[key] ?? []), transfer],
    }
  }, {} as Record<string, ContractTransferEvent[]>)

  const eventsByPositionID: Record<number, PositionRecentEventData> = positionIds.reduce(
    (dict, positionId) => ({
      ...dict,
      [positionId]: { trades: [], collateralUpdates: [] },
    }),
    {} as Record<number, PositionRecentEventData>
  )

  const trades = filterNulls(
    tradeEvents.map(tradeEvent => {
      try {
        const transfers =
          transfersByIdAndHash[getTransferKey(tradeEvent.transactionHash, tradeEvent.args.positionId.toNumber())]
        return getTradeDataFromRecentEvent(tradeEvent, market, transfers)
      } catch (e) {
        return null
      }
    })
  )

  const collateralUpdates = filterNulls(
    updateEvents.map(updateEvent => {
      try {
        const transfers =
          transfersByIdAndHash[getTransferKey(updateEvent.transactionHash, updateEvent.args.positionId.toNumber())]
        return getCollateralUpdateDataFromRecentEvent(updateEvent, market, transfers)
      } catch (e) {
        return null
      }
    })
  )

  trades.forEach(trade => {
    eventsByPositionID[trade.positionId].trades.push(trade)
  })

  collateralUpdates.forEach(update => {
    eventsByPositionID[update.positionId].collateralUpdates.push(update)
  })

  return eventsByPositionID
}
