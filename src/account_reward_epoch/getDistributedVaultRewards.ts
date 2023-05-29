import { ClaimAddedEvent, GlobalRewardEpoch, Market, RewardEpochTokenAmount } from '..'
import fromBigNumber from '../utils/fromBigNumber'

const CLAIM_ADDED_VAULTS_TAG = 'MMV'

export default function getDistributedVaultRewards(
  market: Market,
  globalRewardEpoch: GlobalRewardEpoch,
  claimAddedEvents: ClaimAddedEvent[]
): RewardEpochTokenAmount[] {
  const vaultRewardsMap: Record<string, RewardEpochTokenAmount> = claimAddedEvents
    .filter(event => {
      const tags = event.tag.split('-')
      const allUpperCaseTags = tags.map(tag => tag.toUpperCase())
      return (
        allUpperCaseTags.includes(CLAIM_ADDED_VAULTS_TAG) &&
        allUpperCaseTags.includes(market.baseToken.symbol.toUpperCase()) &&
        market.baseToken.symbol.toUpperCase() !== 'OP' &&
        event.epochTimestamp === globalRewardEpoch.startTimestamp
      )
    })
    .reduce((vaultRewardsMap, event) => {
      const rewardToken = globalRewardEpoch.vaultRewardTokens.find(
        t => t.address.toLowerCase() === event.rewardToken.toLowerCase()
      )
      if (!rewardToken) {
        // console.warn('Missing token info in global epoch config', event.rewardToken)
        return vaultRewardsMap
      }

      if (vaultRewardsMap[rewardToken.address]) {
        vaultRewardsMap[rewardToken.address].amount += fromBigNumber(event.amount, rewardToken.decimals)
      }

      return {
        ...vaultRewardsMap,
        [rewardToken.address]: { ...rewardToken, amount: fromBigNumber(event.amount, rewardToken.decimals) },
      }
    }, {} as Record<string, RewardEpochTokenAmount>)

  return Object.values(vaultRewardsMap)
}
