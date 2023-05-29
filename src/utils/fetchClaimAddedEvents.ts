import { gql } from '@apollo/client/core'
import { BigNumber } from 'ethers'

import { ClaimAddedEvent } from '../account_reward_epoch'
import { CLAIM_ADDED_FRAGMENT, ClaimAddedQueryResult } from '../constants/queries'
import Lyra from '../lyra'
import subgraphRequest from './subgraphRequest'

const claimAddedQuery = gql`
  query claimAddeds($user: String!) {
    claimAddeds(where: { 
      claimer: $user
    }) {
      ${CLAIM_ADDED_FRAGMENT}
    }
  }
`

type ClaimAddedVariables = {
  user: string
}

export default async function fetchClaimAddedEvents(lyra: Lyra, address: string): Promise<ClaimAddedEvent[]> {
  const { data } = await subgraphRequest<{ claimAddeds: ClaimAddedQueryResult[] }, ClaimAddedVariables>(
    lyra.govSubgraphClient,
    {
      query: claimAddedQuery,
      variables: {
        user: address.toLowerCase(),
      },
    }
  )
  return (
    data?.claimAddeds
      .map(ev => ({
        amount: BigNumber.from(ev.amount),
        blockNumber: ev.blockNumber,
        claimer: ev.claimer,
        epochTimestamp: parseInt(ev.epochTimestamp),
        rewardToken: ev.rewardToken,
        timestamp: ev.timestamp,
        tag: ev.tag,
      }))
      // HACK @michaelxuwu - Filter claimAdded mistake
      .filter(
        event => event.rewardToken.toLowerCase() !== '0xCb9f85730f57732fc899fb158164b9Ed60c77D49'.toLowerCase()
      ) ?? []
  )
}
