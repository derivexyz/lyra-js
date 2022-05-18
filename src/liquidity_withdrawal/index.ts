import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { LyraMarketContractId } from '../constants/contracts'
import { WithdrawProcessedEvent, WithdrawQueuedEvent } from '../contracts/typechain/LiquidityPool'
import Lyra from '../lyra'
import { Market } from '../market'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
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
  amount: BigNumber
  tokenPriceAtRequestWithdraw?: BigNumber
  tokenValueAtRequestWithdraw?: BigNumber
  tokenPriceAtWithdraw?: BigNumber
  tokenValueAtWithdraw?: BigNumber
  isPending: boolean
  withdrawalRequestedTimestamp: number
  withdrawalTimestamp: number

  constructor(
    lyra: Lyra,
    market: Market,
    data: {
      queued?: WithdrawQueuedEvent
      processed?: WithdrawProcessedEvent
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
    this.amount = queuedOrProcessed.args.amountWithdrawn
    this.tokenPriceAtRequestWithdraw = ZERO_BN // TODO: @earthtojake tokenPrice needed to be added at withdraw
    this.tokenValueAtRequestWithdraw = ZERO_BN
    this.tokenPriceAtWithdraw = processed?.args.tokenPrice
    this.tokenValueAtWithdraw = processed?.args.tokenPrice.mul(processed?.args.amountWithdrawn)
    this.isPending = !!(queued && processed)
    this.withdrawalRequestedTimestamp = queuedOrProcessed.args.timestamp.toNumber()
    this.withdrawalTimestamp = processed
      ? processed.args.timestamp.toNumber()
      : queued
      ? queued.args.timestamp.add(market.__marketData.marketParameters.lpParams.withdrawalDelay).toNumber()
      : // Should never happen
        0
  }

  // Getters

  static async getByOwner(lyra: Lyra, marketAddress: string, owner: string): Promise<LiquidityWithdrawal[]> {
    const market = await Market.get(lyra, marketAddress)
    const { events } = await fetchLiquidityWithdrawalEventDataByOwner(lyra, market, owner)
    const liquidityWithdrawals: LiquidityWithdrawal[] = events.map(
      event => new LiquidityWithdrawal(lyra, market, event)
    )
    return liquidityWithdrawals
  }

  static async getByQueueId(lyra: Lyra, marketAddress: string, id: string): Promise<LiquidityWithdrawal> {
    const market = await Market.get(lyra, marketAddress)
    const event = await fetchLiquidityWithdrawalEventDataByID(lyra, market, id)
    return new LiquidityWithdrawal(lyra, market, event)
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
