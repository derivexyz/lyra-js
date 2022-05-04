import { TransactionReceipt } from '@ethersproject/providers'
import { BigNumber, Contract } from 'ethers'

import { Board } from '../board'
import { CollateralUpdateData, CollateralUpdateEvent } from '../collateral_update_event'
import { ZERO_ADDRESS } from '../constants/bn'
import { DataSource, LyraMarketContractId, PositionUpdatedType, TradeDirection } from '../constants/contracts'
import { OptionMarket, TradeEvent as ContractTradeEvent } from '../contracts/typechain/OptionMarket'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Position } from '../position'
import { QuoteFeeComponents } from '../quote'
import { Strike } from '../strike'
import fetchEventDataByOwner from '../utils/fetchPositionTradeDataByOwner'
import getCollateralUpdateDataFromEvent from '../utils/getCollateralUpdateDataFromEvent'
import getLyraContractABI from '../utils/getLyraContractABI'
import getMarketAddresses from '../utils/getMarketAddresses'
import getTradeDataFromEvent from '../utils/getTradeDataFromEvent'
import parsePartialPositionUpdatedEventsFromLogs from '../utils/parsePartialPositionUpdatedEventsFromLogs'
import parsePartialTradeEventsFromLogs from '../utils/parsePartialTradeEventsFromLogs'
import parsePartialTransferEventFromLogs from '../utils/parsePartialTransferEventFromLogs'

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
    if (trade.size.isZero()) {
      throw new Error('Trade with no size')
    }
    this.lyra = lyra
    this.__tradeData = trade
    this.__collateralUpdateData = collateralUpdate
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

  static async getByHash(lyra: Lyra, transactionHash: string): Promise<TradeEvent> {
    const receipt = await lyra.provider.getTransactionReceipt(transactionHash)
    const events = parsePartialTradeEventsFromLogs(receipt.logs)
    if (events.length === 0) {
      throw new Error('No Trade events in transaction')
    }
    const { address: marketAddress } = events[0]
    const [{ timestamp }, market] = await Promise.all([
      lyra.provider.getBlock(receipt.blockNumber),
      Market.get(lyra, marketAddress),
    ])
    return TradeEvent.getByReceiptSync(lyra, market, receipt, timestamp)
  }

  static getByReceiptSync(lyra: Lyra, market: Market, receipt: TransactionReceipt, timestamp: number): TradeEvent {
    const transfers = parsePartialTransferEventFromLogs(receipt.logs)
    // Ignore liquidations (which can have multiple trade events)
    const tradeEvent = parsePartialTradeEventsFromLogs(receipt.logs).find(
      t => t.args.trade.tradeDirection !== TradeDirection.Liquidate
    )
    if (!tradeEvent) {
      throw new Error('No Trade event in transaction')
    }
    const trade = getTradeDataFromEvent(market, tradeEvent, transfers, timestamp)
    const collateralUpdate = parsePartialPositionUpdatedEventsFromLogs(receipt.logs).find(
      e =>
        e.args.position.collateral.gt(0) &&
        e.args.positionId.toNumber() === tradeEvent.args.positionId.toNumber() &&
        // Extract matching open / close update event
        [PositionUpdatedType.Opened, PositionUpdatedType.Closed].includes(e.args.updatedType)
    )
    return new TradeEvent(
      lyra,
      DataSource.Log,
      trade,
      collateralUpdate ? getCollateralUpdateDataFromEvent(trade, collateralUpdate, transfers, timestamp) : undefined
    )
  }

  static async getByOwner(lyra: Lyra, owner: string): Promise<TradeEvent[]> {
    const events = await fetchEventDataByOwner(lyra, owner)
    return events.trades.map(
      trade =>
        new TradeEvent(
          lyra,
          DataSource.Subgraph,
          trade,
          events.collateralUpdates.find(c => c.transactionHash === trade.transactionHash)
        )
    )
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

    let timeout: NodeJS.Timeout | null

    const optionMarket = new Contract(
      ZERO_ADDRESS,
      getLyraContractABI(LyraMarketContractId.OptionMarket)
    ) as OptionMarket

    Promise.all([getMarketAddresses(lyra), lyra.provider.getBlock('latest')]).then(async ([addresses, block]) => {
      let prevBlock = block

      const poll = async () => {
        const latestBlock = await lyra.provider.getBlock('latest')
        const fromBlockNumber = prevBlock.number + 1
        const toBlockNumber = latestBlock.number
        if (fromBlockNumber >= toBlockNumber) {
          // Skip if no new blocks
          return
        }
        // Fetch new trades
        const trades: ContractTradeEvent[] = await lyra.provider.send('eth_getLogs', [
          {
            address: addresses,
            fromBlock: BigNumber.from(fromBlockNumber).toHexString(),
            toBlock: BigNumber.from(toBlockNumber).toHexString(),
            topics: [[(optionMarket.filters.Trade().topics ?? [])[0]]],
          },
        ])
        // Parse trade events
        await Promise.all(
          trades.map(async trade => {
            try {
              callback(await TradeEvent.getByHash(lyra, trade.transactionHash))
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
