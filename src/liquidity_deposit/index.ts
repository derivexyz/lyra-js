import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fetchLiquidityDelayReason from '../utils/fetchLiquidityDelayReason'
import fetchLiquidityDepositEventDataByOwner from '../utils/fetchLiquidityDepositEventDataByOwner'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export enum LiquidityDelayReason {
  Liquidity = 'Liquidity',
  Volatility = 'Volatility',
  Keeper = 'Keeper',
}

export type LiquidityDepositFilter = {
  user: string
}

export type DepositQueuedOrProcessedEvent = {
  queued?: LiquidityDepositQueuedEvent
  processed?: LiquidityDepositProcessedEvent
}

export type LiquidityDepositQueuedEvent = {
  depositor: string
  beneficiary: string
  depositQueueId: BigNumber
  amountDeposited: BigNumber
  totalQueuedDeposits: BigNumber
  timestamp: BigNumber
  transactionHash: string
}

export type LiquidityDepositProcessedEvent = {
  caller: string
  beneficiary: string
  depositQueueId: BigNumber
  amountDeposited: BigNumber
  tokenPrice: BigNumber
  tokensReceived: BigNumber
  timestamp: BigNumber
  transactionHash: string
}

export class LiquidityDeposit {
  lyra: Lyra
  __queued?: LiquidityDepositQueuedEvent
  __processed?: LiquidityDepositProcessedEvent
  __market: Market
  queueId?: number
  beneficiary: string
  value: BigNumber
  tokenPriceAtDeposit?: BigNumber
  balance?: BigNumber
  isPending: boolean
  depositRequestedTimestamp: number
  depositTimestamp: number
  delayReason: LiquidityDelayReason | null
  constructor(
    lyra: Lyra,
    market: Market,
    data: {
      queued?: LiquidityDepositQueuedEvent
      processed?: LiquidityDepositProcessedEvent
      delayReason: LiquidityDelayReason | null
    }
  ) {
    // Data
    this.lyra = lyra
    this.__market = market
    this.__queued = data.queued
    this.__processed = data.processed

    // Fields
    const queued = data.queued
    const processed = data.processed
    const queuedOrProcessed = queued ?? processed
    if (!queuedOrProcessed) {
      throw new Error('No queued or processed event for LiquidityDeposit')
    }
    this.queueId = queuedOrProcessed.depositQueueId.toNumber()
    this.beneficiary = queuedOrProcessed.beneficiary
    this.value = queuedOrProcessed.amountDeposited
    this.tokenPriceAtDeposit = processed?.tokenPrice
    this.balance = processed?.tokensReceived
    this.isPending = !processed
    this.depositRequestedTimestamp = queuedOrProcessed.timestamp.toNumber()
    this.depositTimestamp = processed
      ? processed.timestamp.toNumber()
      : queued
      ? queued.timestamp.add(market.__marketData.marketParameters.lpParams.depositDelay).toNumber()
      : // Should never happen
        0
    this.delayReason = data.delayReason
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityDeposit[]> {
    const market = await Market.get(lyra, marketAddress)
    const { events } = await fetchLiquidityDepositEventDataByOwner(lyra, owner, market)
    const liquidityDeposits: LiquidityDeposit[] = await Promise.all(
      events.map(async event => {
        const delayReason = await fetchLiquidityDelayReason(lyra, market, event)
        return new LiquidityDeposit(lyra, market, {
          ...event,
          delayReason,
        })
      })
    )
    return liquidityDeposits
  }

  // Initiate Deposit

  static async deposit(
    lyra: Lyra,
    marketAddressOrName: string,
    beneficiary: string,
    amountQuote: BigNumber
  ): Promise<PopulatedTransaction> {
    const market = await Market.get(lyra, marketAddressOrName)
    const liquidityPoolContract = getLyraMarketContract(
      lyra,
      market.contractAddresses,
      LyraMarketContractId.LiquidityPool
    )
    const data = liquidityPoolContract.interface.encodeFunctionData('initiateDeposit', [beneficiary, amountQuote])
    const tx = await buildTxWithGasEstimate(lyra, liquidityPoolContract.address, beneficiary, data)
    return tx
  }

  // Edges

  market(): Market {
    return this.__market
  }

  // TODO: @dillonlin add a way to retrieve multiple liquidity deposits from multiple markets
}
