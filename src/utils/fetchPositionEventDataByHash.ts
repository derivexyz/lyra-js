import { TransactionReceipt } from '@ethersproject/providers'

import Lyra, { CollateralUpdateEvent, Market, SettleEvent, TradeEvent } from '..'
import { TransferEvent } from '../transfer_event'
import fetchPositionEventDataByIDs from './fetchPositionEventDataByIDs'
import filterNulls from './filterNulls'
import parsePartialPositionUpdatedEventsFromLogs from './parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventsFromLogs from './parsePartialTradeEventsFromLogs'

export default async function fetchPositionEventDataByHash(
  lyra: Lyra,
  transactionHashOrReceipt: TransactionReceipt | string
): Promise<{
  trades: TradeEvent[]
  collateralUpdates: CollateralUpdateEvent[]
  transfers: TransferEvent[]
  settles: SettleEvent[]
}> {
  const receipt =
    typeof transactionHashOrReceipt === 'string'
      ? await lyra.provider.getTransactionReceipt(transactionHashOrReceipt)
      : transactionHashOrReceipt
  const transactionHash = receipt.transactionHash

  const tradeEvents = parsePartialTradeEventsFromLogs(lyra, receipt.logs)
  const updateEvents = parsePartialPositionUpdatedEventsFromLogs(receipt.logs) // Also covers settle events

  let marketAddress: string | null = null
  if (tradeEvents.length) {
    marketAddress = tradeEvents[0].address
  } else if (updateEvents.length) {
    const contractAddresses = await lyra.contractAddresses()
    const optionTokenAddress = updateEvents[0].address
    const marketContractAddresses = contractAddresses.find(
      marketAddresses => marketAddresses.optionToken === optionTokenAddress
    )
    if (marketContractAddresses) {
      marketAddress = marketContractAddresses.optionMarket
    }
  }

  if (!marketAddress) {
    return { trades: [], collateralUpdates: [], transfers: [], settles: [] }
  }

  const market = await Market.get(lyra, marketAddress)

  const positionIds = Array.from(
    new Set([
      ...tradeEvents.map(trade => trade.args.positionId.toNumber()),
      ...updateEvents.map(update => update.args.positionId.toNumber()),
    ])
  )

  // Get event data for unique positions in tx hash
  const eventsByPositionID = await fetchPositionEventDataByIDs(lyra, market, positionIds)

  const events = Object.values(eventsByPositionID).map(({ trades, collateralUpdates, transfers, settle: _settle }) => {
    const tradeData = trades.find(trade => trade.transactionHash === transactionHash)
    const collateralUpdateData = collateralUpdates.find(update => update.transactionHash === transactionHash)
    const transferData = transfers.find(transfer => transfer.transactionHash === transactionHash)
    const settleData = _settle?.transactionHash === transactionHash ? _settle : null

    const trade = tradeData ? new TradeEvent(lyra, tradeData, collateralUpdateData) : null
    const collateralUpdate = collateralUpdateData
      ? new CollateralUpdateEvent(lyra, collateralUpdateData, tradeData)
      : null
    const transfer = transferData ? new TransferEvent(lyra, transferData) : null
    const settle = settleData ? new SettleEvent(lyra, settleData) : null

    return {
      trade,
      collateralUpdate,
      transfer,
      settle,
    }
  })

  const trades = filterNulls(events.map(({ trade }) => trade))
  const collateralUpdates = filterNulls(events.map(({ collateralUpdate }) => collateralUpdate))
  const transfers = filterNulls(events.map(({ transfer }) => transfer))
  const settles = filterNulls(events.map(({ settle }) => settle))

  return {
    trades,
    collateralUpdates,
    transfers,
    settles,
  }
}
