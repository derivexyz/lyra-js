import { BigNumber } from '@ethersproject/bignumber'

import Lyra, { LyraContractId } from '..'
import { ZERO_BN } from '../constants/bn'
import fetchLyraWethStakingData from '../utils/fetchLyraWethStakingData'
import fromBigNumber from '../utils/fromBigNumber'
import getLyraContract from '../utils/getLyraContract'

export class WethLyraStaking {
  lyra: Lyra
  totalStaked: BigNumber
  stakedTokenBalance: BigNumber
  lpTokenValue: number
  stakedTVL: number
  apy: number
  constructor(lyra: Lyra, lpTokenValue: number, stakedTokenBalance: BigNumber, apy: number) {
    this.lyra = lyra
    this.totalStaked = ZERO_BN
    this.lpTokenValue = lpTokenValue
    this.stakedTokenBalance = stakedTokenBalance
    this.stakedTVL = fromBigNumber(stakedTokenBalance) * lpTokenValue
    this.apy = apy
  }

  static async get(lyra: Lyra): Promise<WethLyraStaking> {
    const [gelatoPoolContract, wethLyraStakingRewardsContract, { apy, tokenValue }] = await Promise.all([
      await getLyraContract(lyra, LyraContractId.ArrakisPool),
      await getLyraContract(lyra, LyraContractId.WethLyraStakingRewards),
      await fetchLyraWethStakingData(lyra),
    ])
    const stakedTokenBalance = await gelatoPoolContract.balanceOf(wethLyraStakingRewardsContract.address)
    return new WethLyraStaking(lyra, tokenValue, stakedTokenBalance, apy)
  }
}
