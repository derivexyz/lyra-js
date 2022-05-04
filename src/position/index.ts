import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import Board from '../board'
import CollateralUpdateEvent, { CollateralUpdateData } from '../collateral_update_event'
import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource, PositionState } from '../constants/contracts'
import Market from '../market'
import Option from '../option'
import Strike from '../strike'
import Trade, { TradeOptions } from '../trade'
import TradeEvent, { TradeEventData } from '../trade_event'
import fetchOpenPositionDataByOwner from '../utils/fetchOpenPositionDataByOwner'
import fetchPositionDataByID from '../utils/fetchPositionDataByID'
import fetchPositionDataByOwner from '../utils/fetchPositionDataByOwner'
import getPositionAverageCost from './getPositionAverageCost'
import { PositionCollateral } from './getPositionCollateral'

export type PositionTradeOptions = Omit<TradeOptions, 'premiumSlippage' | 'minOrMaxPremium'>

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
  optionPrice: BigNumber
}

export default class Position {
  // Internal
  private lyra: Lyra
  private __positionData: PositionData
  private __tradeData: TradeEventData[]
  private __collateralUpdateData: CollateralUpdateData[]
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
  currentPricePerOption: BigNumber

  constructor(
    lyra: Lyra,
    source: DataSource,
    position: PositionData,
    trades: TradeEventData[],
    collateralUpdates: CollateralUpdateData[]
  ) {
    // Data
    this.lyra = lyra
    this.__positionData = position
    this.__tradeData = trades
    this.__collateralUpdateData = collateralUpdates
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
    this.currentPricePerOption = position.optionPrice
  }

  // Getters

  static async get(lyra: Lyra, marketAddressOrName: string, positionId: number): Promise<Position> {
    const market = await Market.get(lyra, marketAddressOrName)
    const { position, trades, collateralUpdates, source } = await fetchPositionDataByID(lyra, market, positionId)
    return new Position(lyra, source, position, trades, collateralUpdates)
  }

  static async getOpenByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchOpenPositionDataByOwner(lyra, owner)
    return positions.map(
      ({ position, trades, collateralUpdates }) =>
        new Position(lyra, DataSource.ContractCall, position, trades, collateralUpdates)
    )
  }

  static async getByOwner(lyra: Lyra, owner: string): Promise<Position[]> {
    const positions = await fetchPositionDataByOwner(lyra, owner)
    return positions.map(
      ({ position, trades, collateralUpdates, source }) =>
        new Position(lyra, source, position, trades, collateralUpdates)
    )
  }

  // Dynamic Fields

  averageCostPerOption(): BigNumber {
    return getPositionAverageCost(this.trades())
  }

  pnl(): BigNumber {
    if (this.isOpen && this.size.gt(0)) {
      return this.isLong
        ? this.currentPricePerOption.sub(this.averageCostPerOption()).mul(this.size).div(UNIT)
        : this.averageCostPerOption().sub(this.currentPricePerOption).mul(this.size).div(UNIT)
    } else {
      return ZERO_BN
    }
  }

  pnlPercent(): BigNumber {
    const totalCostOfPosition = this.averageCostPerOption().mul(this.size).div(UNIT)
    const pnl = this.pnl()
    return pnl.mul(UNIT).div(totalCostOfPosition)
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
            this.__collateralUpdateData.find(c => c.transactionHash === trade.transactionHash)
          )
      )
      .sort((a, b) => a.blockNumber - b.blockNumber)
  }

  collateralUpdates(): CollateralUpdateEvent[] {
    return this.__collateralUpdateData
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
    // TODO: @earthtojake Add refresh()
    const option = await this.option()
    return Trade.getSync(this.lyra, this.owner, option, isBuy, size, {
      premiumSlippage: slippage,
      position: this,
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
