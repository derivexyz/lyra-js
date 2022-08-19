import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from 'ethers'

import { LyraMarketContractId } from '../constants/contracts'
import { DepositProcessedEvent, DepositQueuedEvent } from '../contracts/typechain/LiquidityPool'
import Lyra from '../lyra'
import { Market } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fetchLiquidityDelayReason from '../utils/fetchLiquidityDelayReason'
import fetchLiquidityDepositEventDataByID from '../utils/fetchLiquidityDepositEventDataByID'
import fetchLiquidityDepositEventDataByOwner from '../utils/fetchLiquidityDepositEventDataByOwner'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export enum LiquidityDelayReason {
  Liquidity = 'Liquidity',
  Volatility = 'Volatility',
  Keeper = 'Keeper',
}

export class LiquidityDeposit {
  lyra: Lyra
  __queued?: DepositQueuedEvent
  __processed?: DepositProcessedEvent
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
      queued?: DepositQueuedEvent
      processed?: DepositProcessedEvent
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
    this.queueId = queuedOrProcessed.args.depositQueueId.toNumber()
    this.beneficiary = queuedOrProcessed.args.beneficiary
    this.value = queuedOrProcessed.args.amountDeposited
    this.tokenPriceAtDeposit = processed?.args.tokenPrice
    this.balance = processed?.args.tokensReceived
    this.isPending = !processed
    this.depositRequestedTimestamp = queuedOrProcessed.args.timestamp.toNumber()
    this.depositTimestamp = processed
      ? processed.args.timestamp.toNumber()
      : queued
      ? queued.args.timestamp.add(market.__marketData.marketParameters.lpParams.depositDelay).toNumber()
      : // Should never happen
        0
    this.delayReason = data.delayReason
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityDeposit[]> {
    const market = await Market.get(lyra, marketAddress)
    const { events } = await fetchLiquidityDepositEventDataByOwner(lyra, market, owner)
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

  static async getByQueueId(lyra: Lyra, marketAddress: string, id: string): Promise<LiquidityDeposit> {
    const market = await Market.get(lyra, marketAddress)
    const event = await fetchLiquidityDepositEventDataByID(lyra, market, id)
    const delayReason = await fetchLiquidityDelayReason(lyra, market, event)
    return new LiquidityDeposit(lyra, market, {
      ...event,
      delayReason,
    })
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
