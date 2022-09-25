import { LYRA_OPTIMISM_MAINNET_ADDRESS, LyraContractId, WETH_OPTIMISM_MAINNET_ADDRESS } from '../constants/contracts'
import Lyra from '../lyra'
import fetchTokenSpotPrice from './fetchTokenSpotPrice'
import fromBigNumber from './fromBigNumber'
import getLyraContract from './getLyraContract'

const fetchLyraWethStakingData = async (
  lyra: Lyra
): Promise<{
  apy: number
  tokenValue: number
}> => {
  const gelatoPoolContract = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.ArrakisPool)
  const stakingContract = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.WethLyraStakingRewards)
  const [lyraRewardRate, totalStakedTokens, { amount0Current, amount1Current }, totalSupply, lyraPrice, wethPrice] =
    await Promise.all([
      stakingContract.rewardRate(),
      gelatoPoolContract.balanceOf(stakingContract.address),
      gelatoPoolContract.getUnderlyingBalances(),
      gelatoPoolContract.totalSupply(),
      fetchTokenSpotPrice(lyra, LYRA_OPTIMISM_MAINNET_ADDRESS),
      fetchTokenSpotPrice(lyra, WETH_OPTIMISM_MAINNET_ADDRESS),
    ])
  // TODO: Get from pool
  const poolWethValue = fromBigNumber(amount0Current) * wethPrice
  const poolLyraValue = fromBigNumber(amount1Current) * lyraPrice
  const tvl = poolWethValue + poolLyraValue
  const tokenValue = totalSupply ? tvl / fromBigNumber(totalSupply) : 0
  const yieldPerSecondPerToken = totalStakedTokens
    ? fromBigNumber(lyraRewardRate) / fromBigNumber(totalStakedTokens)
    : 0
  const apy = tokenValue > 0 ? (yieldPerSecondPerToken * (24 * 60 * 60 * 365) * (lyraPrice ?? 0)) / tokenValue : 0
  return { apy, tokenValue }
}

export default fetchLyraWethStakingData
