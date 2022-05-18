import { PopulatedTransaction } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import Lyra from '..'
import { LyraContractId } from '../constants/contracts'
import buildTx from '../utils/buildTx'
import getGlobalOwner from '../utils/getGlobalOwner'
import getLyraContract from '../utils/getLyraContract'

export class Admin {
  private lyra: Lyra

  constructor(lyra: Lyra) {
    this.lyra = lyra
  }

  static get(lyra: Lyra): Admin {
    return new Admin(lyra)
  }

  async globalOwner(): Promise<string> {
    return await getGlobalOwner(this.lyra)
  }

  async isMarketPaused(marketAddress: string): Promise<boolean> {
    const synthetixAdapter = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.SynthetixAdapter)
    return await synthetixAdapter.isMarketPaused(marketAddress)
  }

  async isGlobalPaused(): Promise<boolean> {
    const synthetixAdapter = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.SynthetixAdapter)
    return await synthetixAdapter.isGlobalPaused()
  }

  setGlobalPaused(account: string, isPaused: boolean): PopulatedTransaction {
    const synthetixAdapter = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.SynthetixAdapter)
    const calldata = synthetixAdapter.interface.encodeFunctionData('setGlobalPaused', [isPaused])
    const tx = buildTx(this.lyra, synthetixAdapter.address, account, calldata)
    return {
      ...tx,
      gasLimit: BigNumber.from(10_000_000),
    }
  }

  setMarketPaused(account: string, marketAddress: string, isPaused: boolean): PopulatedTransaction {
    const synthetixAdapter = getLyraContract(this.lyra.provider, this.lyra.deployment, LyraContractId.SynthetixAdapter)
    const calldata = synthetixAdapter.interface.encodeFunctionData('setMarketPaused', [marketAddress, isPaused])
    const tx = buildTx(this.lyra, synthetixAdapter.address, account, calldata)
    return {
      ...tx,
      gasLimit: BigNumber.from(10_000_000),
    }
  }
}
