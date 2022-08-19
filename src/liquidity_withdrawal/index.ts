import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from 'ethers'

import { LiquidityDelayReason } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import { WithdrawProcessedEvent, WithdrawQueuedEvent } from '../contracts/typechain/LiquidityPool'
import Lyra from '../lyra'
import { Market } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import fetchLiquidityDelayReason from '../utils/fetchLiquidityDelayReason'
import fetchLiquidityWithdrawalEventDataByID from '../utils/fetchLiquidityWithdrawalEventDataByID'
import fetchLiquidityWithdrawalEventDataByOwner from '../utils/fetchLiquidityWithdrawalEventDataByOwner'
import getLyraMarketContract from '../utils/getLyraMarketContract'

export class LiquidityWithdrawal {
  lyra: Lyra
  __queued?: WithdrawQueuedEvent
  __processed?: WithdrawProcessedEvent
  __market: Market
  queueId?: number
  beneficiary: string
  balance: BigNumber
  tokenPriceAtWithdraw?: BigNumber
  value?: BigNumber
  isPending: boolean
  withdrawalRequestedTimestamp: number
  withdrawalTimestamp: number
  delayReason: LiquidityDelayReason | null
  constructor(
    lyra: Lyra,
    market: Market,
    data: {
      queued?: WithdrawQueuedEvent
      processed?: WithdrawProcessedEvent
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
    this.queueId = queuedOrProcessed.args.withdrawalQueueId.toNumber()
    this.beneficiary = queuedOrProcessed.args.beneficiary
    this.balance = queued?.args.amountWithdrawn ?? ZERO_BN
    this.tokenPriceAtWithdraw = processed?.args.tokenPrice
    this.value = processed?.args.quoteReceived
    this.isPending = !processed
    this.withdrawalRequestedTimestamp = queuedOrProcessed.args.timestamp.toNumber()
    this.withdrawalTimestamp = processed
      ? processed.args.timestamp.toNumber()
      : queued
      ? queued.args.timestamp.add(market.__marketData.marketParameters.lpParams.withdrawalDelay).toNumber()
      : // Should never happen
        0
    this.delayReason = data.delayReason
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityWithdrawal[]> {
    const market = await Market.get(lyra, marketAddress)
    const { events } = await fetchLiquidityWithdrawalEventDataByOwner(lyra, market, owner)
    const liquidityWithdrawals: LiquidityWithdrawal[] = await Promise.all(
      events.map(async event => {
        const delayReason = (await fetchLiquidityDelayReason(lyra, market, event)) as LiquidityDelayReason | null
        return new LiquidityWithdrawal(lyra, market, {
          ...event,
          delayReason,
        })
      })
    )
    return liquidityWithdrawals
  }

  static async getByQueueId(lyra: Lyra, marketAddress: string, id: string): Promise<LiquidityWithdrawal> {
    const market = await Market.get(lyra, marketAddress)
    const event = await fetchLiquidityWithdrawalEventDataByID(lyra, market, id)
    const delayReason = (await fetchLiquidityDelayReason(lyra, market, event)) as LiquidityDelayReason | null
    return new LiquidityWithdrawal(lyra, market, {
      ...event,
      delayReason,
    })
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
      LyraMarketContractId.LiquidityPool
    )
    const data = liquidityPoolContract.interface.encodeFunctionData('initiateWithdraw', [
      beneficiary,
      amountLiquidityTokens,
    ])
    const tx = await buildTxWithGasEstimate(lyra, liquidityPoolContract.address, beneficiary, data)
    return tx
  }

  // Edges

  market(): Market {
    return this.__market
  }
}
