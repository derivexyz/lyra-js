import { BigNumber } from '@ethersproject/bignumber'

import { LyraGlobalContractId } from '../constants/contracts'
import Lyra from '../lyra'
import fetchLyraStakingParams, { LyraStakingParams } from '../utils/fetchLyraStakingParams'
import getGlobalContract from '../utils/getGlobalContract'

export type LyraStakingAccount = {
  lyraStaking: LyraStaking
  isInUnstakeWindow: boolean
  isInCooldown: boolean
  unstakeWindowStartTimestamp: number | null
  unstakeWindowEndTimestamp: number | null
}

export class LyraStaking {
  lyra: Lyra
  cooldownPeriod: number
  unstakeWindow: number
  totalSupply: BigNumber
  tokenPrice: BigNumber
  apy: number

  constructor(lyra: Lyra, stakingParams: LyraStakingParams) {
    this.lyra = lyra
    this.cooldownPeriod = stakingParams.cooldownPeriod
    this.unstakeWindow = stakingParams.unstakeWindow
    this.totalSupply = stakingParams.totalSupply
    this.tokenPrice = stakingParams.tokenPrice
    this.apy = stakingParams.apy
  }

  // Getters

  static async get(lyra: Lyra): Promise<LyraStaking> {
    const stakingParams = await fetchLyraStakingParams(lyra)
    return new LyraStaking(lyra, stakingParams)
  }

  static async getByOwner(lyra: Lyra, address: string): Promise<LyraStakingAccount> {
    if (!lyra.ethereumProvider || !lyra.optimismProvider) {
      throw new Error('Ethereum and Optimism provider required.')
    }
    const lyraStakingModuleContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    const [block, lyraStaking, accountCooldownBN] = await Promise.all([
      lyra.provider.getBlock('latest'),
      LyraStaking.get(lyra),
      lyraStakingModuleContract.stakersCooldowns(address),
    ])
    const accountCooldown = accountCooldownBN.toNumber()
    const cooldownStartTimestamp = accountCooldown > 0 ? accountCooldown : null
    const cooldownEndTimestamp = accountCooldown > 0 ? accountCooldown + lyraStaking.cooldownPeriod : null
    const unstakeWindowStartTimestamp = cooldownEndTimestamp
    const unstakeWindowEndTimestamp = unstakeWindowStartTimestamp
      ? unstakeWindowStartTimestamp + lyraStaking.unstakeWindow
      : null
    const isInUnstakeWindow =
      !!unstakeWindowStartTimestamp &&
      !!unstakeWindowEndTimestamp &&
      block.timestamp >= unstakeWindowStartTimestamp &&
      block.timestamp <= unstakeWindowEndTimestamp
    const isInCooldown =
      !!cooldownStartTimestamp &&
      !!cooldownEndTimestamp &&
      block.timestamp >= cooldownStartTimestamp &&
      block.timestamp <= cooldownEndTimestamp
    return {
      lyraStaking,
      isInUnstakeWindow,
      isInCooldown,
      unstakeWindowStartTimestamp,
      unstakeWindowEndTimestamp,
    }
  }

  // TODO: move claimable rewards into get()
  static async claimableRewards(lyra: Lyra, address: string): Promise<BigNumber> {
    const lyraStakingModuleContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    return await lyraStakingModuleContract.getTotalRewardsBalance(address)
  }
}
