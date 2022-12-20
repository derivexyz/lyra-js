import { BigNumber } from '@ethersproject/bignumber'

import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import callContractWithMulticall from '../utils/callContractWithMulticall'
import fetchLyraTokenSpotPrice from '../utils/fetchLyraTokenSpotPrice'
import getLyraContract from '../utils/getLyraContract'

type StakingData = {
  cooldownPeriod: number
  unstakeWindow: number
  lyraPrice: number
  totalSupply: BigNumber
}

export class LyraStaking {
  lyra: Lyra
  cooldownPeriod: number
  unstakeWindow: number
  lyraPrice: number
  totalSupply: BigNumber
  constructor(lyra: Lyra, data: StakingData) {
    // Data
    this.lyra = lyra
    this.cooldownPeriod = data.cooldownPeriod
    this.unstakeWindow = data.unstakeWindow
    this.totalSupply = data.totalSupply
    this.lyraPrice = data.lyraPrice
  }

  // Getters

  static async get(lyra: Lyra): Promise<LyraStaking> {
    const lyraStakingModuleContract = getLyraContract(lyra, LyraContractId.LyraStakingModuleProxy)
    const cooldownPeriodCallData = lyraStakingModuleContract.interface.encodeFunctionData('COOLDOWN_SECONDS')
    const unstakeWindowCallData = lyraStakingModuleContract.interface.encodeFunctionData('UNSTAKE_WINDOW')
    const totalSupplyCallData = lyraStakingModuleContract.interface.encodeFunctionData('totalSupply')
    const [[cooldownPeriod], [unstakeWindow], [totalSupply]] = await callContractWithMulticall<
      [[BigNumber], [BigNumber], [BigNumber]]
    >(lyra, [
      {
        callData: cooldownPeriodCallData,
        contract: lyraStakingModuleContract,
        functionFragment: 'COOLDOWN_SECONDS',
      },
      {
        callData: unstakeWindowCallData,
        contract: lyraStakingModuleContract,
        functionFragment: 'UNSTAKE_WINDOW',
      },
      {
        callData: totalSupplyCallData,
        contract: lyraStakingModuleContract,
        functionFragment: 'totalSupply',
      },
    ])

    const lyraPrice = await fetchLyraTokenSpotPrice(lyra)
    return new LyraStaking(lyra, {
      cooldownPeriod: cooldownPeriod.toNumber(),
      unstakeWindow: unstakeWindow.toNumber(),
      totalSupply,
      lyraPrice,
    })
  }
}
