import { PopulatedTransaction } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import Lyra from '../lyra'

export class Stake {
  lyra: Lyra
  amount: BigNumber
  inflationaryAPY: BigNumber
  tradingBase: BigNumber
  tradingBoost: BigNumber
  lpMultiplier: BigNumber
  tx: PopulatedTransaction | null
  constructor(
    lyra: Lyra,
    data: {
      amount: BigNumber
      inflationaryAPY: BigNumber
      tradingBase: BigNumber
      tradingBoost: BigNumber
      lpMultiplier: BigNumber
      tx: PopulatedTransaction | null
    }
  ) {
    // Data
    this.lyra = lyra
    this.amount = data.amount
    this.inflationaryAPY = data.inflationaryAPY
    this.tradingBase = data.tradingBase
    this.tradingBoost = data.tradingBoost
    this.lpMultiplier = data.lpMultiplier
    this.tx = data.tx
  }

  // Getters

  static async get(lyra: Lyra, owner: string, amount: BigNumber): Promise<Stake> {
    const inflationaryAPY = ZERO_BN // TODO: @dillonlin fetch and calculate
    const tradingBase = ZERO_BN // TODO: @dillonlin fetch and calculate
    const tradingBoost = ZERO_BN // TODO: @dillonlin fetch and calculate
    const lpMultiplier = ZERO_BN // TODO: @dillonlin fetch and calculate
    const tx = null // TODO: @dillonlin create from contracts
    return new Stake(lyra, {
      amount,
      inflationaryAPY,
      tradingBase,
      tradingBoost,
      lpMultiplier,
      tx,
    })
  }
}
