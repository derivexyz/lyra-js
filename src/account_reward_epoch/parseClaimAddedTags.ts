import { ClaimAddedEvent } from '../contracts/common/typechain/MultiDistributor'

enum ClaimAddedProgramTags {
  MMV = 'MMV',
  TRADING = 'TRADING',
  STAKING = 'STAKING',
}
enum ClaimAddedRewardTags {
  OP = 'OP',
  LYRA = 'LYRA',
}

export default function parseClaimAddedTags(claimAddedEvents: ClaimAddedEvent[]): {
  vaultRewards: Record<string, Record<ClaimAddedRewardTags, boolean>>
  tradingRewards: Record<ClaimAddedRewardTags, boolean>
  stakingRewards: Record<ClaimAddedRewardTags, boolean>
} {
  const vaultRewards: Record<string, Record<ClaimAddedRewardTags, boolean>> = {}
  const tradingRewards: Record<ClaimAddedRewardTags, boolean> = { LYRA: false, OP: false }
  const stakingRewards: Record<ClaimAddedRewardTags, boolean> = { LYRA: false, OP: false }

  claimAddedEvents.map(event => {
    const tag = event.args.tag
    if (tag.startsWith(ClaimAddedProgramTags.MMV)) {
      const [_tag, marketKey, token] = tag.split('-')
      if (!vaultRewards[marketKey]) {
        vaultRewards[marketKey] = { LYRA: false, OP: false }
      }
      vaultRewards[marketKey][token as ClaimAddedRewardTags] = true
    } else if (tag.startsWith(ClaimAddedProgramTags.TRADING)) {
      const [_tag, token] = tag.split('-')
      tradingRewards[token as ClaimAddedRewardTags] = true
    } else if (tag.startsWith(ClaimAddedProgramTags.STAKING)) {
      const [_tag, token] = tag.split('-')
      stakingRewards[token as ClaimAddedRewardTags] = true
    }
  })

  return { vaultRewards, tradingRewards, stakingRewards }
}
