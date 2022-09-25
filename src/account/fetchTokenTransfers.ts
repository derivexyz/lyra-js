import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { gql, GraphQLClient } from 'graphql-request'

import { TokenTransfer, TokenTransferResult } from '../constants/queries'
import Lyra, { Deployment } from '../lyra'

const TOKEN_TRANSFER_QUERY = gql`
  amount
  timestamp
  blockNumber
  from
  to
  token {
    id
  }
`

const transfersQuery = gql`
  query tokenTransfers($owner: String!, $startTimestamp: Int!) {
    # From transfers
    fromTokenTransfers: tokenTransfers(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { from: $owner, timestamp_gte: $startTimestamp }
    ) {
      ${TOKEN_TRANSFER_QUERY}
    }
    # To transfers
    toTokenTransfers: tokenTransfers(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { to: $owner, timestamp_gte: $startTimestamp }
    ) {
      ${TOKEN_TRANSFER_QUERY}
    }
  }
`

const transfersSubgraph = new GraphQLClient('https://api.thegraph.com/subgraphs/name/paulvaden/transfers-test')

export default async function fetchTokenTransfers(
  lyra: Lyra,
  owner: string,
  startTimestamp: number
): Promise<{
  from: TokenTransfer[]
  to: TokenTransfer[]
}> {
  if (lyra.deployment !== Deployment.Mainnet) {
    // subgraph only supported on mainnet
    return {
      from: [],
      to: [],
    }
  }
  const res = await transfersSubgraph.request<
    {
      fromTokenTransfers: TokenTransferResult[]
      toTokenTransfers: TokenTransferResult[]
    },
    {
      owner: string
      startTimestamp: number
    }
  >(transfersQuery, {
    owner: owner.toLowerCase(),
    startTimestamp,
  })

  const from = res.fromTokenTransfers.map(token => ({
    amount: BigNumber.from(token.amount),
    timestamp: token.timestamp,
    blockNumber: token.blockNumber,
    from: getAddress(token.from),
    to: getAddress(token.to),
    tokenAddress: getAddress(token.token.id),
  }))

  const to = res.toTokenTransfers.map(token => ({
    amount: BigNumber.from(token.amount),
    timestamp: token.timestamp,
    blockNumber: token.blockNumber,
    from: getAddress(token.from),
    to: getAddress(token.to),
    tokenAddress: getAddress(token.token.id),
  }))

  return { from, to }
}
