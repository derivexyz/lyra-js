import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { LiquidityCircuitBreaker, LiquidityDelayReason } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market, MarketLiquiditySnapshot } from '../market'
import buildTx from '../utils/buildTx'
import fetchLiquidityWithdrawalEventDataByOwner from '../utils/fetchLiquidityWithdrawalEventDataByOwner'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export type LiquidityWithdrawalEvents =
  | {
      isInstant: false
      isProcessed: false
      queued: LiquidityWithdrawalQueuedEvent
    }
  | {
      isInstant: true
      isProcessed: true
      processed: LiquidityWithdrawalProcessedEvent
    }
  | {
      isInstant: false
      isProcessed: true
      queued: LiquidityWithdrawalQueuedEvent
      processed: LiquidityWithdrawalProcessedEvent
    }

export type LiquidityWithdrawalQueuedEvent = {
  withdrawer: string
  beneficiary: string
  queueId: number
  amountWithdrawn: BigNumber
  totalQueuedWithdrawals: BigNumber
  timestamp: number
  transactionHash: string
}

export type LiquidityWithdrawalProcessedEvent = {
  caller: string
  beneficiary: string
  queueId: number
  amountWithdrawn: BigNumber
  tokenPrice: BigNumber
  quoteReceived: BigNumber
  totalQueuedWithdrawals: BigNumber
  timestamp: number
  transactionHash: string
}

export class LiquidityWithdrawal {
  lyra: Lyra
  __queued?: LiquidityWithdrawalQueuedEvent
  __processed?: LiquidityWithdrawalProcessedEvent
  __market: Market
  queueId?: number
  beneficiary: string
  balance: BigNumber
  tokenPriceAtWithdraw?: BigNumber
  value?: BigNumber
  isPending: boolean
  withdrawalRequestedTimestamp: number
  withdrawalTimestamp: number
  timeToWithdrawal: number
  delayReason: LiquidityDelayReason | null
  constructor(
    lyra: Lyra,
    data: {
      events: LiquidityWithdrawalEvents
      market: Market
      circuitBreaker: LiquidityCircuitBreaker | null
      marketLiquidity: MarketLiquiditySnapshot
    }
  ) {
    // Data
    this.lyra = lyra
    this.__market = data.market

    // Fields
    const queued = !data.events.isInstant ? data.events.queued : null
    const processed = data.events.isProcessed ? data.events.processed : null
    const queuedOrProcessed = queued ?? processed
    if (!queuedOrProcessed) {
      throw new Error('No queued or processed event for LiquidityWithdrawal')
    }
    this.queueId = queuedOrProcessed.queueId
    this.beneficiary = queuedOrProcessed.beneficiary
    this.balance = queued?.amountWithdrawn ?? ZERO_BN
    this.tokenPriceAtWithdraw = processed?.tokenPrice
    this.value = processed?.amountWithdrawn
    this.isPending = !processed
    this.withdrawalRequestedTimestamp = queuedOrProcessed.timestamp
    this.withdrawalTimestamp = processed
      ? processed.timestamp
      : queued
      ? queued.timestamp + data.market.params.withdrawalDelay
      : // Should never happen
        0
    this.timeToWithdrawal = Math.max(0, this.withdrawalTimestamp - data.market.block.timestamp)
    this.delayReason =
      this.timeToWithdrawal === 0 &&
      this.isPending &&
      data.circuitBreaker &&
      data.circuitBreaker.timestamp > data.market.block.timestamp
        ? data.circuitBreaker.reason
        : null
  }

  // Getters

  static async getByOwner(lyra: Lyra, market: Market, owner: string): Promise<LiquidityWithdrawal[]> {
    const [{ events, circuitBreaker }, marketLiquidity] = await Promise.all([
      fetchLiquidityWithdrawalEventDataByOwner(lyra, owner, market),
      market.liquidity(),
    ])
    const liquidityDeposits = events.map(
      events =>
        new LiquidityWithdrawal(lyra, {
          market,
          events,
          circuitBreaker,
          marketLiquidity,
        })
    )
    return liquidityDeposits
  }

  // Transactions

  static initiateWithdraw(market: Market, beneficiary: string, amountLiquidityTokens: BigNumber): PopulatedTransaction {
    const liquidityPoolContract = getLyraMarketContract(
      market.lyra,
      market.contractAddresses,
      market.lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const data = liquidityPoolContract.interface.encodeFunctionData('initiateWithdraw', [
      beneficiary,
      amountLiquidityTokens,
    ])
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
