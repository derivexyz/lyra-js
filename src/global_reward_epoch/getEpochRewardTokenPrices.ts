import { GlobalRewardEpochData } from '../utils/fetchGlobalRewardEpochData'
import { RewardEpochTokenPriceMap, RewardTokenPrices } from '.'

const getEpochRewardTokenPrices = (
  epoch: GlobalRewardEpochData,
  prices: RewardTokenPrices
): RewardEpochTokenPriceMap => {
  const rewardTokenPriceMap: RewardEpochTokenPriceMap = {}
  const { globalStakingRewards, globalMMVRewards, globalTradingRewards } = epoch
  const allRewardTokens = [
    globalStakingRewards,
    Object.values(globalMMVRewards).flat(),
    globalTradingRewards.totalRewards ? globalTradingRewards.totalRewards : [],
  ].flat()
  allRewardTokens.forEach(token => {
    if (['lyra', 'stklyra'].includes(token.symbol.toLowerCase())) {
      rewardTokenPriceMap[token.address] = {
        price: prices.lyraPrice,
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    } else if (token.symbol.toLowerCase() === 'op') {
      rewardTokenPriceMap[token.address] = {
        price: prices.opPrice,
        address: token.address,
        decimals: token.decimals,
        symbol: token.symbol,
      }
    }
  })
  return rewardTokenPriceMap
}

export default getEpochRewardTokenPrices
