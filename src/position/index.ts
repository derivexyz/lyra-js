import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { CollateralUpdateData, CollateralUpdateEvent } from '../collateral_update_event'
import { UNIT } from '../constants/bn'
import { DataSource, PositionState } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import { Option } from '../option'
import { Strike } from '../strike'
import { Trade, TradeOptions } from '../trade'
import { TradeEvent, TradeEventData } from '../trade_event'
import { TransferEvent, TransferEventData } from '../transfer_event'
import fetchOpenPositionDataByOwner from '../utils/fetchOpenPositionDataByOwner'
import fetchPositionDataByID from '../utils/fetchPositionDataByID'
import fetchPositionDataByOwner from '../utils/fetchPositionDataByOwner'
import getAverageCostPerOption from '../utils/getAverageCostPerOption'
import getBreakEvenPrice from '../utils/getBreakEvenPrice'
import getSettlePnl from '../utils/getSettlePnl'
import { PositionCollateral } from './getPositionCollateral'
import getPositionRealizedPnl from './getPositionRealizedPnl'
import getPositionRealizedPnlPercent from './getPositionRealizedPnlPercent'
import getPositionUnrealizedPnl from './getPositionUnrealizedPnl'
import getPositionUnrealizedPnlPercent from './getPositionUnrealizedPnlPercent'

export type PositionData = {
  id: number
  blockNumber: number
  marketName: string
  marketAddress: string
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  owner: string
  size: BigNumber
  isCall: boolean
  isLong: boolean
  collateral?: PositionCollateral
  state: PositionState
  isOpen: boolean
  isLiquidated: boolean
  isSettled: boolean
  pricePerOption: BigNumber
  spotPriceAtExpiry?: BigNumber
  isInTheMoney: boolean
}

export type PositionTradeOptions = Omit<TradeOptions, 'positionId'>

export class Position {
  private lyra: Lyra
  // TODO: Use variables
  __positionData: PositionData
  private __tradeData: TradeEventData[]
  private __collateralUpdateData: CollateralUpdateData[]
  private __transferData: TransferEventData[]
  __source: DataSource
  id: number
  marketName: string
  marketAddress: string
  strikeId: number
  strikePrice: BigNumber
  expiryTimestamp: number
  owner: string
  size: BigNumber
  isCall: boolean
  isLong: boolean
  collateral?: PositionCollateral
  state: PositionState
  isOpen: boolean
  isLiquidated: boolean
  isSettled: boolean
  pricePerOption: BigNumber
  spotPriceAtExpiry?: BigNumber
  isInTheMoney: boolean

  constructor(
    lyra: Lyra,
    source: DataSource,
    position: PositionData,
    trades: TradeEventData[],
    collateralUpdates: CollateralUpdateData[],
    transfers: TransferEventData[]
  ) {
    // Data
    this.lyra = lyra
    this.__positionData = position
    this.__tradeData = trades
    this.__collateralUpdateData = collateralUpdates
    this.__transferData = transfers
    this.__source = source

    // Fields
    this.owner = position.owner
    this.id = position.id
    this.strikeId = position.strikeId
    this.strikePrice = position.strikePrice
    this.expiryTimestamp = position.expiryTimestamp
    this.marketName = position.marketName
    this.marketAddress = position.marketAddress
    this.isCall = position.isCall
    this.isLong = position.isLong
    this.state = position.state

    this.isOpen = position.isOpen
    this.size = position.size
    this.isLiquidated = position.isLiquidated
    this.isSettled = position.isSettled
    this.collateral = position.collateral
    this.pricePerOption = position.pricePerOption
    this.spotPriceAtExpiry = position.spotPriceAtExpiry
    this.isInTheMoney = position.isInTheMoney
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, positionId: number): Promise<Position> {
    const market = await Market.get(lyra, marketAddressOrName)
    const { position, trades, collateralUpdates, transfers } = await fetchPositionDataByID(lyra, market, positionId)
    return new Position(lyra, DataSource.ContractCall, position, trades, collateralUpdates, transfers)
  }

  static async getOpenByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchOpenPositionDataByOwner(lyra, owner)
    return positions.map(
      ({ position, trades, collateralUpdates, transfers }) =>
        new Position(lyra, DataSource.ContractCall, position, trades, collateralUpdates, transfers)
    )
  }

  static async getByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchPositionDataByOwner(lyra, owner)
    return positions.map(
      ({ position, trades, collateralUpdates, transfers, source }) =>
        new Position(lyra, source, position, trades, collateralUpdates, transfers)
    )
  }

  // Dynamic Fields

  sizeBeforeClose(): BigNumber {
    if (!this.isOpen && this.size.isZero()) {
      // Position manually closed, use size before last trade
      const trades = this.trades()
      const lastTrade = trades[trades.length - 1]
      return lastTrade.prevSizeSync(this)
    } else {
      // Position may be settled or still open
      return this.size
    }
  }

  avgCostPerOption(): BigNumber {
    return getAverageCostPerOption(this.trades())
  }

  // TODO: @earthtojake Add option to account for base collateral P&L
  realizedPnl(): BigNumber {
    return getPositionRealizedPnl(this)
  }

  realizedPnlPercent(): BigNumber {
    return getPositionRealizedPnlPercent(this)
  }

  unrealizedPnl(): BigNumber {
    return getPositionUnrealizedPnl(this)
  }

  unrealizedPnlPercent(): BigNumber {
    return getPositionUnrealizedPnlPercent(this)
  }

  breakEven(): BigNumber {
    return getBreakEvenPrice(
      this.isCall,
      this.strikePrice,
      this.avgCostPerOption().mul(this.sizeBeforeClose()).div(UNIT)
    )
  }

  payoff(spotPriceAtExpiry: BigNumber, avgSpotPrice?: BigNumber): BigNumber {
    return getSettlePnl(
      this.isLong,
      this.isCall,
      this.strikePrice,
      spotPriceAtExpiry,
      this.avgCostPerOption(),
      this.sizeBeforeClose(),
      this.collateral?.liquidationPrice,
      this.collateral && this.collateral.isBase && avgSpotPrice
        ? // TODO: @earthtojake Use rolling average spot price
          { collateral: this.collateral.amount, avgSpotPrice }
        : undefined
    )
  }

  // Edges

  trades(): TradeEvent[] {
    return this.__tradeData
      .map(
        trade =>
          new TradeEvent(
            this.lyra,
            // Positions from contract calls have Trades derived from logs
            this.__source === DataSource.ContractCall ? DataSource.Log : this.__source,
            trade,
            !this.isLong
              ? this.__collateralUpdateData.find(c => c.transactionHash === trade.transactionHash)
              : undefined
          )
      )
      .sort((a, b) => a.blockNumber - b.blockNumber)
  }

  collateralUpdates(): CollateralUpdateEvent[] {
    return !this.isLong
      ? this.__collateralUpdateData
          .map(
            collatUpdate =>
              new CollateralUpdateEvent(
                this.lyra,
                // Positions from contract calls have CollateralUpdates derived from logs
                this.__source === DataSource.ContractCall ? DataSource.Log : this.__source,
                collatUpdate,
                this.__tradeData.find(t => t.transactionHash === collatUpdate.transactionHash)
              )
          )
          .sort((a, b) => a.blockNumber - b.blockNumber)
      : []
  }

  transfers(): TransferEvent[] {
    return this.__transferData.map(
      transferData =>
        new TransferEvent(
          this.lyra,
          this.__source === DataSource.ContractCall ? DataSource.Log : this.__source,
          transferData
        )
    )
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

  // Trade

  async trade(isBuy: boolean, size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    return await Trade.get(this.lyra, this.owner, this.marketAddress, this.strikeId, this.isCall, isBuy, size, {
      premiumSlippage: slippage,
      positionId: this.id,
      ...options,
    })
  }

  async add(size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    const isBuy = this.isLong
    return await this.trade(isBuy, size, slippage, options)
  }

  async reduce(size: BigNumber, slippage: number, options?: PositionTradeOptions): Promise<Trade> {
    const isBuy = !this.isLong
    return await this.trade(isBuy, size, slippage, options)
  }

  async close(slippage: number): Promise<Trade> {
    return await this.reduce(this.size, slippage, { setToCollateral: this.collateral?.amount })
  }
}
