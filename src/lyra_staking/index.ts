import { BigNumber } from '@ethersproject/bignumber'

import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
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
    const lyraStakingModuleContract = getLyraContract(
      lyra.provider,
      lyra.deployment,
      LyraContractId.LyraStakingModuleProxy
    )
    // TODO: @DillonLin Implement with multicall
    const [cooldownPeriod, unstakeWindow, totalSupply, lyraPrice] = await Promise.all([
      lyraStakingModuleContract.COOLDOWN_SECONDS(),
      lyraStakingModuleContract.UNSTAKE_WINDOW(),
      lyraStakingModuleContract.totalSupply(),
      fetchLyraTokenSpotPrice(lyra),
    ])
    return new LyraStaking(lyra, {
      cooldownPeriod: cooldownPeriod.toNumber(),
      unstakeWindow: unstakeWindow.toNumber(),
      totalSupply,
      lyraPrice,
    })
  }
}
