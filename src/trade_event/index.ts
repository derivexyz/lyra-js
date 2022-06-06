import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { BlockTag, Log } from '@ethersproject/providers'

import { Board } from '../board'
import { CollateralUpdateData, CollateralUpdateEvent } from '../collateral_update_event'
import { ZERO_ADDRESS } from '../constants/bn'
import { DataSource, LyraMarketContractId } from '../constants/contracts'
import { PartialTradeEventGroup } from '../constants/events'
import { OptionMarket, TradeEvent as ContractTradeEvent } from '../contracts/typechain/OptionMarket'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { QuoteFeeComponents } from '../quote'
import { Strike } from '../strike'
import fetchPositionEventsByOwner from '../utils/fetchPositionEventsByOwner'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getCollateralUpdateDataFromEvent from '../utils/getCollateralUpdateDataFromEvent'
import getLyraContractABI from '../utils/getLyraContractABI'
import getMarketAddresses from '../utils/getMarketAddresses'
import getPositionPreviousTrades from '../utils/getPositionPreviousTrades'
import getTradeDataFromEvent from '../utils/getTradeDataFromEvent'
import getTradeRealizedPnl from '../utils/getTradeRealizedPnl'
import getTradeRealizedPnlPercent from '../utils/getTradeRealizedPnlPercent'
import parsePartialPositionUpdatedEventsFromLogs from '../utils/parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventsFromLogs from '../utils/parsePartialTradeEventsFromLogs'
import parsePartialTransferEventsFromLogs from '../utils/parsePartialTransferEventsFromLogs'
import sortEvents, { SortEventOptions } from '../utils/sortEvents'
import getTradeEventNewSize from './getTradeEventNewSize'
import getTradeEventPreviousSize from './getTradeEventPreviousSize'

export type TradeLiquidation = ContractTradeEvent['args']['liquidation']

export type TradeEventData = {
  positionId: number
  marketName: string
  marketAddress: string
  blockNumber: number
  timestamp: number
  transactionHash: string
  trader: string
  size: BigNumber
  isCall: boolean
  isOpen: boolean
  isBuy: boolean
  isLong: boolean
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  spotPrice: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  externalSwapFee: BigNumber
  iv: BigNumber
  skew: BigNumber
  baseIv: BigNumber
  volTraded: BigNumber
  setCollateralTo?: BigNumber
  isBaseCollateral?: boolean
  isForceClose: boolean
  isLiquidation: boolean
  liquidation?: TradeLiquidation
}

export type TradeEventListener = {
  off: () => void
}

export type TradeEventListenerCallback = (trade: TradeEvent) => void

export type TradeEventListenerOptions = {
  pollInterval?: number
  startBlockNumber?: BlockTag
}

export class TradeEvent {
  private lyra: Lyra
  private __tradeData: TradeEventData
  private __collateralUpdateData?: CollateralUpdateData
  __source: DataSource
  positionId: number
  marketName: string
  marketAddress: string
  blockNumber: number
  timestamp: number
  transactionHash: string
  trader: string
  size: BigNumber
  isCall: boolean
  isOpen: boolean
  isBuy: boolean
  isLong: boolean
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  spotPrice: BigNumber
  pricePerOption: BigNumber
  premium: BigNumber
  fee: BigNumber
  feeComponents: QuoteFeeComponents
  iv: BigNumber
  volTraded: BigNumber
  skew: BigNumber
  baseIv: BigNumber
  setCollateralTo?: BigNumber
  isBaseCollateral?: boolean
  isForceClose: boolean
  isLiquidation: boolean
  liquidation?: TradeLiquidation

  constructor(lyra: Lyra, source: DataSource, trade: TradeEventData, collateralUpdate?: CollateralUpdateData) {
    this.lyra = lyra
    this.__tradeData = trade
    if (!trade.isLong && collateralUpdate) {
      // Only set collateral update data for shorts
      this.__collateralUpdateData = collateralUpdate
    }
    this.__source = source
    this.positionId = trade.positionId
    this.marketName = trade.marketName
    this.marketAddress = trade.marketAddress
    this.timestamp = trade.timestamp
    this.blockNumber = trade.blockNumber
    this.transactionHash = trade.transactionHash
    this.trader = trade.trader
    this.size = trade.size
    this.isCall = trade.isCall
    this.isOpen = trade.isOpen
    this.isBuy = trade.isBuy
    this.isLong = trade.isLong
    this.strikeId = trade.strikeId
    this.strikePrice = trade.strikePrice
    this.expiryTimestamp = trade.expiryTimestamp
    this.spotPrice = trade.spotPrice
    this.pricePerOption = trade.pricePerOption
    this.premium = trade.premium
    this.fee = trade.fee
    this.feeComponents = trade.feeComponents
    this.iv = trade.iv
    this.skew = trade.skew
    this.baseIv = trade.baseIv
    this.volTraded = trade.volTraded
    this.setCollateralTo = trade.setCollateralTo
    this.isBaseCollateral = trade.isBaseCollateral
    this.isForceClose = trade.isForceClose
    this.isLiquidation = trade.isLiquidation
    this.liquidation = trade.liquidation
  }

  // Getters

  static async getByHash(lyra: Lyra, transactionHash: string): Promise<TradeEvent[]> {
    const receipt = await lyra.provider.getTransactionReceipt(transactionHash)
    const events = parsePartialTradeEventsFromLogs(receipt.logs)
    if (events.length === 0) {
      throw new Error('No Trade events in transaction')
    }
    const { address: marketAddress } = events[0]
    const market = await Market.get(lyra, marketAddress)
    return TradeEvent.getByLogsSync(lyra, market, receipt.logs)
  }

  static getByLogsSync(lyra: Lyra, market: Market, logs: Log[]): TradeEvent[] {
    const trades = parsePartialTradeEventsFromLogs(logs)
    if (trades.length === 0) {
      throw new Error('No Trade events in logs')
    }
    const updates = parsePartialPositionUpdatedEventsFromLogs(logs)
    const transfers = parsePartialTransferEventsFromLogs(logs)

    const eventsByPositionID: Record<number, PartialTradeEventGroup> = {}

    trades.forEach(trade => {
      eventsByPositionID[trade.args.positionId.toNumber()] = {
        trade,
        transfers: [],
      }
    })
    updates.forEach(collateralUpdate => {
      const id = collateralUpdate.args.positionId.toNumber()
      if (eventsByPositionID[id]) {
        eventsByPositionID[id].collateralUpdate = collateralUpdate
      }
    })
    transfers.forEach(transfer => {
      const id = transfer.args.tokenId.toNumber()
      if (eventsByPositionID[id]) {
        eventsByPositionID[id].transfers.push(transfer)
      }
    })

    return Object.values(eventsByPositionID).map(
      ({ trade: tradeEvent, collateralUpdate: collateralUpdateEvent, transfers: transferEvents }) => {
        const trade = getTradeDataFromEvent(market, tradeEvent, transferEvents)
        const update = collateralUpdateEvent
          ? getCollateralUpdateDataFromEvent(collateralUpdateEvent, trade, transferEvents)
          : undefined
        return new TradeEvent(lyra, DataSource.Log, trade, update)
      }
    )
  }

  static async getByOwner(lyra: Lyra, owner: string, options?: SortEventOptions): Promise<TradeEvent[]> {
    const events = await fetchPositionEventsByOwner(lyra, owner)
    return sortEvents(
      events.trades.map(
        trade =>
          new TradeEvent(
            lyra,
            DataSource.Subgraph,
            trade,
            events.collateralUpdates.find(c => c.transactionHash === trade.transactionHash)
          )
      ),
      options
    )
  }

  // Dynamic fields

  async realizedPnl(): Promise<BigNumber> {
    const position = await this.position()
    return getTradeRealizedPnl(position, this)
  }

  async realizedPnlPercent(): Promise<BigNumber> {
    const position = await this.position()
    return getTradeRealizedPnlPercent(position, this)
  }

  async newAvgCostPerOption(): Promise<BigNumber> {
    const position = await this.position()
    return this.newAvgCostPerOptionSync(position)
  }

  async prevAvgCostPerOption(): Promise<BigNumber> {
    const position = await this.position()
    return this.prevAvgCostPerOptionSync(position)
  }

  async newSize(): Promise<BigNumber> {
    const position = await this.position()
    return getTradeEventNewSize(position, this)
  }

  async prevSize(): Promise<BigNumber> {
    const position = await this.position()
    return getTradeEventPreviousSize(position, this)
  }

  realizedPnlSync(position: Position): BigNumber {
    return getTradeRealizedPnl(position, this)
  }

  realizedPnlPercentSync(position: Position): BigNumber {
    return getTradeRealizedPnlPercent(position, this)
  }

  newAvgCostPerOptionSync(position: Position): BigNumber {
    return getAverageCostPerOption(getPositionPreviousTrades(position, this).concat([this]))
  }

  prevAvgCostPerOptionSync(position: Position): BigNumber {
    return getAverageCostPerOption(getPositionPreviousTrades(position, this))
  }

  newSizeSync(position: Position): BigNumber {
    return getTradeEventNewSize(position, this)
  }

  prevSizeSync(position: Position): BigNumber {
    return getTradeEventPreviousSize(position, this)
  }

  // Edges

  collateralUpdate(): CollateralUpdateEvent | null {
    if (!this.__collateralUpdateData) {
      return null
    }
    return new CollateralUpdateEvent(
      this.lyra,
      this.__source === DataSource.ContractCall ? DataSource.Log : this.__source,
      this.__collateralUpdateData,
      this.__tradeData
    )
  }

  async position(): Promise<Position> {
    return await Position.get(this.lyra, this.marketAddress, this.positionId)
  }

  async option(): Promise<Option> {
    return await Option.get(this.lyra, this.marketAddress, this.strikeId, this.isCall)
  }

  async strike(): Promise<Strike> {
    return await Strike.get(this.lyra, this.marketAddress, this.strikeId)
  }

  async board(): Promise<Board> {
    return (await this.strike()).board()
  }

  async market(): Promise<Market> {
    return await Market.get(this.lyra, this.marketAddress)
  }

  // Listeners

  static on(lyra: Lyra, callback: TradeEventListenerCallback, options?: TradeEventListenerOptions): TradeEventListener {
    const ms = options?.pollInterval ?? 7.5 * 1000
    const startBlockTag = options?.startBlockNumber ?? 'latest'

    let timeout: NodeJS.Timeout | null

    const optionMarket = new Contract(
      ZERO_ADDRESS,
      getLyraContractABI(LyraMarketContractId.OptionMarket)
    ) as OptionMarket

    Promise.all([getMarketAddresses(lyra), lyra.provider.getBlock(startBlockTag)]).then(async ([addresses, block]) => {
      console.debug(`Polling from block ${block.number} every ${ms}ms`)
      let prevBlock = block

      const poll = async () => {
        const latestBlock = await lyra.provider.getBlock('latest')
        const fromBlockNumber = prevBlock.number + 1
        const toBlockNumber = latestBlock.number
        if (fromBlockNumber >= toBlockNumber) {
          // Skip if no new blocks
          setTimeout(poll, ms)
          return
        }
        console.debug(
          `Querying block range: ${fromBlockNumber} to ${toBlockNumber} (${toBlockNumber - fromBlockNumber} blocks)`
        )
        // Fetch new trades
        const trades: ContractTradeEvent[] = await lyra.provider.send('eth_getLogs', [
          {
            address: addresses.map(a => a.optionMarket),
            fromBlock: BigNumber.from(fromBlockNumber).toHexString(),
            toBlock: BigNumber.from(toBlockNumber).toHexString(),
            topics: [[(optionMarket.filters.Trade().topics ?? [])[0]]],
          },
        ])
        if (trades.length > 0) {
          console.debug(`Found ${trades.length} new trades`)
        }
        // Parse trade events
        await Promise.all(
          trades.map(async trade => {
            try {
              const tradeEvents = await TradeEvent.getByHash(lyra, trade.transactionHash)
              tradeEvents.map(tradeEvent => callback(tradeEvent))
            } catch (e) {
              console.warn('Failed to read Trade event', trade.transactionHash)
            }
          })
        )

        // Poll
        prevBlock = latestBlock
        setTimeout(poll, ms)
      }

      timeout = setTimeout(poll, ms)
    })

    return {
      off: () => {
        if (timeout) {
          clearTimeout(timeout)
        }
      },
    }
  }
}
