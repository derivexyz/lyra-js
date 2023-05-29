import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market, MarketLiquiditySnapshot } from '../market'
import buildTx from '../utils/buildTx'
import fetchLiquidityDepositEventDataByOwner from '../utils/fetchLiquidityDepositEventDataByOwner'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export enum LiquidityDelayReason {
  Liquidity = 'Liquidity',
  Volatility = 'Volatility',
  Keeper = 'Keeper',
}

export type LiquidityDepositFilter = {
  user: string
}

export type LiquidityDepositEvents =
  | {
      isInstant: false
      isProcessed: false
      queued: LiquidityDepositQueuedEvent
    }
  | {
      isInstant: true
      isProcessed: true
      processed: LiquidityDepositProcessedEvent
    }
  | {
      isInstant: false
      isProcessed: true
      queued: LiquidityDepositQueuedEvent
      processed: LiquidityDepositProcessedEvent
    }

export type LiquidityCircuitBreaker = {
  timestamp: number
  reason: LiquidityDelayReason
}

export type LiquidityDepositQueuedEvent = {
  depositor: string
  beneficiary: string
  queueId: number
  amountDeposited: BigNumber
  totalQueuedDeposits: BigNumber
  timestamp: number
  transactionHash: string
}

export type LiquidityDepositProcessedEvent = {
  caller: string
  beneficiary: string
  queueId: number
  amountDeposited: BigNumber
  tokenPrice: BigNumber
  tokensReceived: BigNumber
  timestamp: number
  transactionHash: string
}

export class LiquidityDeposit {
  lyra: Lyra
  __events: LiquidityDepositEvents
  __market: Market
  queueId: number
  beneficiary: string
  value: BigNumber
  tokenPriceAtDeposit?: BigNumber
  balance?: BigNumber
  isPending: boolean
  depositRequestedTimestamp: number
  depositTimestamp: number
  timeToDeposit: number
  transactionHash: string
  delayReason: LiquidityDelayReason | null
  constructor(
    lyra: Lyra,
    data: {
      market: Market
      events: LiquidityDepositEvents
      circuitBreaker: LiquidityCircuitBreaker | null
      marketLiquidity: MarketLiquiditySnapshot
    }
  ) {
    // Data
    this.lyra = lyra
    this.__market = data.market
    this.__events = data.events

    // Fields
    const queued = !data.events.isInstant ? data.events.queued : null
    const processed = data.events.isProcessed ? data.events.processed : null
    const queuedOrProcessed = (data.events.isInstant ? processed : data.events.queued) as
      | LiquidityDepositQueuedEvent
      | LiquidityDepositProcessedEvent
    this.transactionHash = queuedOrProcessed.transactionHash
    this.queueId = queuedOrProcessed.queueId
    this.beneficiary = queuedOrProcessed.beneficiary
    this.value = queuedOrProcessed.amountDeposited
    this.tokenPriceAtDeposit = processed?.tokenPrice
    this.balance = processed?.tokensReceived
    this.isPending = !processed
    this.depositRequestedTimestamp = queuedOrProcessed.timestamp
    this.depositTimestamp = processed
      ? processed.timestamp
      : queued
      ? queued.timestamp + data.market.params.depositDelay
      : // Should never happen
        0
    this.timeToDeposit = Math.max(0, this.depositTimestamp - data.market.block.timestamp)
    this.delayReason =
      this.timeToDeposit === 0 &&
      this.isPending &&
      data.circuitBreaker &&
      data.circuitBreaker.timestamp > data.market.block.timestamp
        ? data.circuitBreaker.reason
        : null
  }

  // Getters

  static async getByOwner(lyra: Lyra, market: Market, owner: string): Promise<LiquidityDeposit[]> {
    const [{ events, circuitBreaker }, marketLiquidity] = await Promise.all([
      fetchLiquidityDepositEventDataByOwner(lyra, owner, market),
      market.liquidity(),
    ])
    const liquidityDeposits = events.map(
      events =>
        new LiquidityDeposit(lyra, {
          market,
          events,
          circuitBreaker,
          marketLiquidity,
        })
    )
    return liquidityDeposits
  }

  // Transactions

  static approve(market: Market, owner: string, amountQuote: BigNumber) {
    const liquidityPoolContract = getLyraMarketContract(
      market.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const erc20 = getERC20Contract(market.lyra.provider, market.quoteToken.address)
    const data = erc20.interface.encodeFunctionData('approve', [liquidityPoolContract.address, amountQuote])
    return buildTx(market.lyra.provider, market.lyra.provider.network.chainId, erc20.address, owner, data)
  }

  static initiateDeposit(market: Market, beneficiary: string, amountQuote: BigNumber): PopulatedTransaction {
    const liquidityPoolContract = getLyraMarketContract(
      market.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const data = liquidityPoolContract.interface.encodeFunctionData('initiateDeposit', [beneficiary, amountQuote])
    return buildTx(
      market.lyra.provider,
      market.lyra.provider.network.chainId,
      liquidityPoolContract.address,
      beneficiary,
      data
    )
  }

  // Edges

  market(): Market {
    return this.__market
  }
}
