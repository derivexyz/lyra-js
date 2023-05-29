import { gql } from '@apollo/client/core'
import { BigNumber } from 'ethers'

import { ClaimEvent } from '../account_reward_epoch'
import { CLAIM_FRAGMENT, ClaimAddedQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import subgraphRequest from './subgraphRequest'

const claimQuery = gql`
  query claims($user: String!) {
    claims(where: { 
      claimer: $user
    }) {
      ${CLAIM_FRAGMENT}
    }
  }
`

type ClaimAddedVariables = {
  user: string
}

export default async function fetchClaimEvents(lyra: Lyra, address: string): Promise<ClaimEvent[]> {
  const { data } = await subgraphRequest<{ claims: ClaimAddedQueryResult[] }, ClaimAddedVariables>(
    lyra.govSubgraphClient,
    {
      query: claimQuery,
      variables: {
        user: address.toLowerCase(),
      },
    }
  )
  return (
    data?.claims.map(ev => ({
      amount: BigNumber.from(ev.amount),
      blockNumber: ev.blockNumber,
      claimer: ev.claimer,
      rewardToken: ev.rewardToken,
      timestamp: ev.timestamp,
    })) ?? []
  )
}
