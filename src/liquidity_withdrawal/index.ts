import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { LiquidityDelayReason } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import { Market, MarketLiquiditySnapshot } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fetchLiquidityWithdrawalEventDataByOwner from '../utils/fetchLiquidityWithdrawalEventDataByOwner'
import getLiquidityDelayReason from '../utils/getLiquidityDelayReason'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export type LiquidityWithdrawalFilter = {
  user: string
}

export type WithdrawalQueuedOrProcessedEvent = {
  queued?: LiquidityWithdrawalQueuedEvent
  processed?: LiquidityWithdrawalProcessedEvent
}

export type LiquidityWithdrawalQueuedEvent = {
  withdrawer: string
  beneficiary: string
  withdrawalQueueId: BigNumber
  amountWithdrawn: BigNumber
  totalQueuedWithdrawals: BigNumber
  timestamp: BigNumber
  transactionHash: string
}

export type LiquidityWithdrawalProcessedEvent = {
  caller: string
  beneficiary: string
  withdrawalQueueId: BigNumber
  amountWithdrawn: BigNumber
  tokenPrice: BigNumber
  quoteReceived: BigNumber
  totalQueuedWithdrawals: BigNumber
  timestamp: BigNumber
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
    market: Market,
    data: {
      queued?: LiquidityWithdrawalQueuedEvent
      processed?: LiquidityWithdrawalProcessedEvent
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
      throw new Error('No queued or processed event for LiquidityWithdrawal')
    }
    this.queueId = queuedOrProcessed.withdrawalQueueId.toNumber()
    this.beneficiary = queuedOrProcessed.beneficiary
    this.balance = queued?.amountWithdrawn ?? ZERO_BN
    this.tokenPriceAtWithdraw = processed?.tokenPrice
    this.value = processed?.amountWithdrawn
    this.isPending = !processed
    this.withdrawalRequestedTimestamp = queuedOrProcessed.timestamp.toNumber()
    this.withdrawalTimestamp = processed
      ? processed.timestamp.toNumber()
      : queued
      ? queued.timestamp.add(market.params.withdrawalDelay).toNumber()
      : // Should never happen
        0
    this.timeToWithdrawal = Math.max(0, this.withdrawalTimestamp - market.block.timestamp)
    this.delayReason =
      this.timeToWithdrawal === 0 && this.isPending
        ? getLiquidityDelayReason(market, data.cbTimestamp, data.marketLiquidity)
        : null
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityWithdrawal[]> {
    const market = await Market.get(lyra, marketAddress)
    const liquidityPoolContract = getLyraMarketContract(
      lyra,
      market.contractAddresses,
      lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const [{ events }, cbTimestamp, marketLiquidity] = await Promise.all([
      fetchLiquidityWithdrawalEventDataByOwner(lyra, owner, market),
      liquidityPoolContract.CBTimestamp(),
      market.liquidity(),
    ])
    return events.map(
      event =>
        new LiquidityWithdrawal(lyra, market, {
          ...event,
          cbTimestamp,
          marketLiquidity,
        })
    )
  }

  // Initiate Withdraw

  static async withdraw(
    lyra: Lyra,
    marketAddressOrName: string,
    beneficiary: string,
    amountLiquidityTokens: BigNumber
  ): Promise<PopulatedTransaction> {
    const market = await Market.get(lyra, marketAddressOrName)
    const liquidityPoolContract = getLyraMarketContract(
      lyra,
      market.contractAddresses,
      lyra.version,
      LyraMarketContractId.LiquidityPool
    )
    const data = liquidityPoolContract.interface.encodeFunctionData('initiateWithdraw', [
      beneficiary,
      amountLiquidityTokens,
    ])
    const tx = await buildTxWithGasEstimate(
      lyra.provider,
      lyra.provider.network.chainId,
      liquidityPoolContract.address,
      beneficiary,
      data
    )
    return tx
  }

  // Edges

  market(): Market {
    return this.__market
  }
}
