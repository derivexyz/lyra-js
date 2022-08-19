enum ClaimAddedProgramTags {
  MMV = 'MMV',
  TRADING = 'TRADING',
  STAKING = 'STAKING',
}
enum ClaimAddedRewardTags {
  OP = 'OP',
  LYRA = 'LYRA',
}

export default function getClaimAddedTags(
  vaultRewards: Record<
    string,
    {
      isIgnored: boolean
      lyra: number
      op: number
    }
  >,
  tradingRewards: {
    effectiveRebateRate: number
    lyraRebate: number
    opRebate: number
    tradingFees: number
  },
  stakingRewards: {
    lyra: number
    op: number
    isIgnored: boolean
  }
): { [key: string]: boolean } {
  const allTags: string[] = []
  Object.entries(vaultRewards).forEach(([marketKey, rewards]) => {
    if (rewards.lyra > 0) {
      allTags.push(`${ClaimAddedProgramTags.MMV}-${marketKey}-${ClaimAddedRewardTags.LYRA}`)
    }
    if (rewards.op > 0) {
      allTags.push(`${ClaimAddedProgramTags.MMV}-${marketKey}-${ClaimAddedRewardTags.OP}`)
    }
  })
  if (tradingRewards.lyraRebate > 0) {
    allTags.push(`${ClaimAddedProgramTags.TRADING}-${ClaimAddedRewardTags.LYRA}`)
  }
  if (tradingRewards.opRebate > 0) {
    allTags.push(`${ClaimAddedProgramTags.TRADING}-${ClaimAddedRewardTags.OP}`)
  }
  if (stakingRewards.op > 0) {
    allTags.push(`${ClaimAddedProgramTags.STAKING}-${ClaimAddedRewardTags.OP}`)
  }
  // if (stakingRewards.lyra > 0) {
  //   allTags.push(`${ClaimAddedProgramTags.STAKING}-${ClaimAddedRewardTags.LYRA}`)
  // }

  return allTags.reduce((tags, tag) => ({ ...tags, [tag]: false }), {})
}
