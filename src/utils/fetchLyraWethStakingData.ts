import { BigNumber } from 'ethers'

import {
  LYRA_OPTIMISM_MAINNET_ADDRESS,
  LyraGlobalContractId,
  OP_OPTIMISM_MAINNET_ADDRESS,
  WETH_OPTIMISM_MAINNET_ADDRESS,
} from '../constants/contracts'
import { SECONDS_IN_TWO_WEEKS, SECONDS_IN_YEAR } from '../constants/time'
import Lyra from '../lyra'
import callContractWithMulticall from './callContractWithMulticall'
import fetchTokenSpotPrice from './fetchTokenSpotPrice'
import fromBigNumber from './fromBigNumber'
import getGlobalContract from './getGlobalContract'

const fetchLyraWethStakingData = async (
  lyra: Lyra
): Promise<{
  apy: number
  tokenValue: number
}> => {
  const gelatoPoolContract = getGlobalContract(lyra, LyraGlobalContractId.ArrakisPool, lyra.optimismProvider)
  const stakingContract = getGlobalContract(lyra, LyraGlobalContractId.WethLyraStakingRewards, lyra.optimismProvider)
  const [lyraPrice, wethPrice, opPrice, globalRewardEpoch] = await Promise.all([
    fetchTokenSpotPrice(lyra, LYRA_OPTIMISM_MAINNET_ADDRESS),
    fetchTokenSpotPrice(lyra, WETH_OPTIMISM_MAINNET_ADDRESS),
    fetchTokenSpotPrice(lyra, OP_OPTIMISM_MAINNET_ADDRESS),
    lyra.latestGlobalRewardEpoch(),
  ])
  const balanceOfCallData = gelatoPoolContract.interface.encodeFunctionData('balanceOf', [stakingContract.address])
  const getUnderlyingBalancesCallData = gelatoPoolContract.interface.encodeFunctionData('getUnderlyingBalances')
  const totalSupplyCallData = gelatoPoolContract.interface.encodeFunctionData('totalSupply')

  const [[balanceOf], [amount0Current, amount1Current], [supply]] = await callContractWithMulticall<
    [[BigNumber], [BigNumber, BigNumber], [BigNumber]]
  >(
    lyra,
    [
      {
        contract: gelatoPoolContract,
        callData: balanceOfCallData,
        functionFragment: 'balanceOf',
      },
      {
        contract: gelatoPoolContract,
        callData: getUnderlyingBalancesCallData,
        functionFragment: 'getUnderlyingBalances',
      },
      {
        contract: gelatoPoolContract,
        callData: totalSupplyCallData,
        functionFragment: 'totalSupply',
      },
    ],
    lyra.optimismProvider
  )

  const poolWethValue = fromBigNumber(amount0Current) * wethPrice
  const poolLyraValue = fromBigNumber(amount1Current) * lyraPrice
  const tvl = poolWethValue + poolLyraValue
  const tokenValue = supply ? tvl / fromBigNumber(supply) : 0
  const opRewardRate =
    (globalRewardEpoch?.wethLyraStaking.find(token => token.symbol.toLowerCase() === 'op')?.amount ?? 0) /
    SECONDS_IN_TWO_WEEKS
  const yieldPerSecondPerToken = balanceOf ? opRewardRate / fromBigNumber(balanceOf) : 0
  const apy = tokenValue > 0 ? (yieldPerSecondPerToken * SECONDS_IN_YEAR * (opPrice ?? 0)) / tokenValue : 0
  return { apy, tokenValue }
}

export default fetchLyraWethStakingData
