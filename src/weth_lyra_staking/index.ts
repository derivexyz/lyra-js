import { BigNumber } from '@ethersproject/bignumber'

import Lyra, { LyraGlobalContractId, Network } from '..'
import { ZERO_BN } from '../constants/bn'
import fetchLyraWethStakingData from '../utils/fetchLyraWethStakingData'
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
    if (lyra.network === Network.Arbitrum) {
      throw new Error('LYRA-ETH staking is not supported on Arbitrum')
    }
    this.lyra = lyra
    this.totalStaked = ZERO_BN
    this.lpTokenValue = lpTokenValue
    this.stakedTokenBalance = stakedTokenBalance
    this.stakedTVL = fromBigNumber(stakedTokenBalance) * lpTokenValue
    this.apy = apy
  }

  static async get(lyra: Lyra): Promise<WethLyraStaking> {
    const [gelatoPoolContract, wethLyraStakingRewardsContract, { apy, tokenValue }] = await Promise.all([
      getGlobalContract(lyra, LyraGlobalContractId.ArrakisPool, lyra.optimismProvider),
      getGlobalContract(lyra, LyraGlobalContractId.WethLyraStakingRewards, lyra.optimismProvider),
      await fetchLyraWethStakingData(lyra),
    ])
    const stakedTokenBalance = await gelatoPoolContract.balanceOf(wethLyraStakingRewardsContract.address)
    return new WethLyraStaking(lyra, tokenValue, stakedTokenBalance, apy)
  }
}
