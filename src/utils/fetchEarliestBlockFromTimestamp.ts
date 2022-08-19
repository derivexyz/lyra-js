import { gql } from 'graphql-request'

import Lyra from '../lyra'

type BlockTimestamp = {
  number: string
  timestamp: string
}

const blocksQuery = gql`
  query blocks($startTimestamp: Int) {
    blocks(first: 1, orderBy: timestamp, orderDirection: asc, where: { timestamp_gte: $startTimestamp }) {
      number
      timestamp
    }
  }
`

export default async function fetchEarliestBlocksFromTimestamp(
  lyra: Lyra,
  startTimestamp: number
): Promise<BlockTimestamp> {
  const res = await lyra.blockSubgraphClient.request<{ blocks: BlockTimestamp[] }, { startTimestamp: number }>(
    blocksQuery,
    {
      startTimestamp,
    }
  )
  return res.blocks[0]
}
