import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market, MarketLiquiditySnapshot } from '../market'
import buildTx from '../utils/buildTx'
import fetchLiquidityDepositEventDataByOwner from '../utils/fetchLiquidityDepositEventDataByOwner'
import getERC20Contract from '../utils/getERC20Contract'
import getLiquidityDelayReason from '../utils/getLiquidityDelayReason'
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
  timeToDeposit: number
  delayReason: LiquidityDelayReason | null
  constructor(
    lyra: Lyra,
    market: Market,
    data: {
      queued?: LiquidityDepositQueuedEvent
      processed?: LiquidityDepositProcessedEvent
      cbTimestamp: BigNumber
      marketLiquidity: MarketLiquiditySnapshot
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
      ? queued.timestamp.add(market.params.depositDelay).toNumber()
      : // Should never happen
        0
    this.timeToDeposit = Math.max(0, this.depositTimestamp - market.block.timestamp)
    this.delayReason =
      this.timeToDeposit === 0 && this.isPending
        ? getLiquidityDelayReason(market, data.cbTimestamp, data.marketLiquidity)
        : null
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityDeposit[]> {
    const market = await Market.get(lyra, marketAddress)
    const liquidityPoolContract = getLyraMarketContract(
      lyra,
      market.contractAddresses,
      lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const [{ events }, cbTimestamp, marketLiquidity] = await Promise.all([
      fetchLiquidityDepositEventDataByOwner(lyra, owner, market),
      liquidityPoolContract.CBTimestamp(),
      market.liquidity(),
    ])
    const liquidityDeposits: LiquidityDeposit[] = await Promise.all(
      events.map(async event => {
        return new LiquidityDeposit(lyra, market, {
          ...event,
          cbTimestamp,
          marketLiquidity,
        })
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
