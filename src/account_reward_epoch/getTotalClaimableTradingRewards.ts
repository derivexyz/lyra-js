import { ClaimAddedEvent, ClaimEvent, RewardEpochToken, RewardEpochTokenAmount } from '..'
import fromBigNumber from '../utils/fromBigNumber'

const CLAIM_ADDED_TRADING_TAG = 'TRADING'

export default function getTotalClaimableTradingRewards(
  rewardTokens: RewardEpochToken[],
  claimAddedEvents: ClaimAddedEvent[],
  claimEvents: ClaimEvent[]
): RewardEpochTokenAmount[] {
  const tradingRewardsMap: Record<string, RewardEpochTokenAmount> = claimAddedEvents
    .filter(event => {
      const tags = event.tag.split('-')
      return tags.includes(CLAIM_ADDED_TRADING_TAG)
    })
    .reduce((tradingRewardsMap, event) => {
      const isClaimed = claimEvents.some(
        claimEvent => claimEvent.timestamp > event.timestamp && claimEvent.rewardToken === event.rewardToken
      )

      if (isClaimed) {
        return tradingRewardsMap
      }

      const rewardToken = rewardTokens.find(t => t.address.toLowerCase() === event.rewardToken.toLowerCase())
      if (!rewardToken) {
        console.warn('Missing token info in global epoch config', event.rewardToken)
        return tradingRewardsMap
      }

      if (tradingRewardsMap[rewardToken.address]) {
        tradingRewardsMap[rewardToken.address].amount += fromBigNumber(event.amount, rewardToken.decimals)
      }

      return {
        ...tradingRewardsMap,
        [rewardToken.address]: { ...rewardToken, amount: fromBigNumber(event.amount, rewardToken.decimals) },
      }
    }, {} as Record<string, RewardEpochTokenAmount>)

  return Object.values(tradingRewardsMap).filter(r => r.amount > 0)
}
