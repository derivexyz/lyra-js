import { BigNumber } from '@ethersproject/bignumber'

import Lyra, { LyraGlobalContractId } from '..'
import { ZERO_BN } from '../constants/bn'
import fetchWethLyraStakingData from '../utils/fetchWethLyraStakingData'
import fromBigNumber from '../utils/fromBigNumber'
import getGlobalContract from '../utils/getGlobalContract'

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
    const [arrakisVaultContract, arrakisRewardsContract, { apy, tokenValue }] = await Promise.all([
      getGlobalContract(lyra, LyraGlobalContractId.ArrakisPoolL1, lyra.ethereumProvider),
      getGlobalContract(lyra, LyraGlobalContractId.WethLyraStakingRewardsL1, lyra.ethereumProvider),
      await fetchWethLyraStakingData(lyra),
    ])
    const stakedTokenBalance = await arrakisVaultContract.balanceOf(arrakisRewardsContract.address)
    return new WethLyraStaking(lyra, tokenValue, stakedTokenBalance, apy)
  }
}
