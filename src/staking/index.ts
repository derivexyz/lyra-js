import { Contract } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { ZERO_BN } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContractABI from '../utils/getLyraContractABI'
import getLyraContractAddress from '../utils/getLyraContractAddress'

export class Staking {
  lyra: Lyra
  apy: BigNumber
  yieldPer1KPerDay: BigNumber
  cooldownPeriod: BigNumber
  unstakeWindow: BigNumber
  totalSupply: BigNumber
  constructor(
    lyra: Lyra,
    data: {
      apy: BigNumber
      yieldPer1KPerDay: BigNumber
      cooldownPeriod: BigNumber
      unstakeWindow: BigNumber
      totalSupply: BigNumber
    }
  ) {
    // Data
    this.lyra = lyra
    this.apy = data.apy
    this.yieldPer1KPerDay = data.yieldPer1KPerDay
    this.cooldownPeriod = data.cooldownPeriod
    this.unstakeWindow = data.unstakeWindow
    this.totalSupply = data.totalSupply
  }

  // Getters

  static async get(lyra: Lyra): Promise<Staking> {
    const address = getLyraContractAddress(lyra.deployment, LyraContractId.LyraStakingModule)
    const abi = getLyraContractABI(LyraContractId.LyraStakingModule)
    const lyraStakingModuleContract = new Contract(address, abi, lyra.provider)
    const cooldownPeriod = lyraStakingModuleContract.COOLDOWN_SECONDS()
    const unstakeWindow = lyraStakingModuleContract.UNSTAKE_WINDOW()
    const totalSupply = await lyraStakingModuleContract.totalSupply()
    const data = {
      apy: ZERO_BN,
      yieldPer1KPerDay: ZERO_BN,
      cooldownPeriod,
      unstakeWindow,
      totalSupply,
    }
    return new Staking(lyra, data)
  }
}
