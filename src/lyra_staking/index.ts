import { BigNumber } from '@ethersproject/bignumber'
import { PopulatedTransaction } from '@ethersproject/contracts'

import { ZERO_BN } from '../constants/bn'
import { LyraGlobalContractId } from '../constants/contracts'
import { SECONDS_IN_YEAR } from '../constants/time'
import Lyra from '../lyra'
import buildTxWithGasEstimate from '../utils/buildTxWithGasEstimate'
import callContractWithMulticall from '../utils/callContractWithMulticall'
import fetchLyraTokenSpotPrice from '../utils/fetchLyraTokenSpotPrice'
import fromBigNumber from '../utils/fromBigNumber'
import getGlobalContract from '../utils/getGlobalContract'
import toBigNumber from '../utils/toBigNumber'

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
    // if ([Network.Arbitrum, Network.Optimism].includes(lyra.network)) {
    //   throw new Error(`Staking is not supported on ${lyra.network}`)
    // }
    // Data
    this.lyra = lyra
    this.cooldownPeriod = data.cooldownPeriod
    this.unstakeWindow = data.unstakeWindow
    this.totalSupply = data.totalSupply
    this.lyraPrice = data.lyraPrice
  }

  // Getters

  static async get(lyra: Lyra): Promise<LyraStaking> {
    const lyraStakingModuleContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    const cooldownPeriodCallData = lyraStakingModuleContract.interface.encodeFunctionData('COOLDOWN_SECONDS')
    const unstakeWindowCallData = lyraStakingModuleContract.interface.encodeFunctionData('UNSTAKE_WINDOW')
    const totalSupplyCallData = lyraStakingModuleContract.interface.encodeFunctionData('totalSupply')
    const [[cooldownPeriod], [unstakeWindow], [totalSupply]] = await callContractWithMulticall<
      [[BigNumber], [BigNumber], [BigNumber]]
    >(
      lyra,
      [
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
      ],
      lyra.ethereumProvider
    )

    const lyraPrice = await fetchLyraTokenSpotPrice(lyra)
    return new LyraStaking(lyra, {
      cooldownPeriod: cooldownPeriod.toNumber(),
      unstakeWindow: unstakeWindow.toNumber(),
      totalSupply,
      lyraPrice,
    })
  }

  static async getStakingRewardsBalance(lyra: Lyra, owner: string): Promise<BigNumber> {
    const lyraStakingModuleContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    return await lyraStakingModuleContract.getTotalRewardsBalance(owner)
  }

  static async getStakingRewardsApy(lyra: Lyra): Promise<BigNumber> {
    const lyraStakingModuleContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    const [assets, totalSupply, lyraTokenSpotPrice] = await Promise.all([
      lyraStakingModuleContract.assets('0xCb9f85730f57732fc899fb158164b9Ed60c77D49'),
      lyraStakingModuleContract.totalSupply(),
      fetchLyraTokenSpotPrice(lyra),
    ])
    const emissionPerSecond = assets.emissionPerSecond

    const apy = totalSupply.gt(ZERO_BN)
      ? (fromBigNumber(emissionPerSecond) * SECONDS_IN_YEAR * (lyraTokenSpotPrice ?? 0)) / fromBigNumber(totalSupply)
      : 0
    return toBigNumber(apy)
  }

  static async claimRewards(lyra: Lyra, owner: string): Promise<PopulatedTransaction> {
    const lyraStakingModuleProxyContract = getGlobalContract(
      lyra,
      LyraGlobalContractId.LyraStakingModule,
      lyra.ethereumProvider
    )
    const totalRewardsBalance = await this.getStakingRewardsBalance(lyra, owner)
    const data = lyraStakingModuleProxyContract.interface.encodeFunctionData('claimRewards', [
      owner,
      totalRewardsBalance,
    ])
    const tx = await buildTxWithGasEstimate(
      lyra.ethereumProvider ?? lyra.provider,
      1,
      lyraStakingModuleProxyContract.address,
      owner,
      data
    )
    return tx
  }
}
