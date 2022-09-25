import { gql } from 'graphql-request'

import { PartialBlock } from '../constants/blocks'
import Lyra from '../lyra'

const blocksQuery = gql`
  query blocks($startTimestamp: Int) {
    blocks(first: 1, orderBy: timestamp, orderDirection: asc, where: { timestamp_gte: $startTimestamp }) {
      number
      timestamp
    }
  }
`

export default async function fetchBlockForTimestamp(lyra: Lyra, startTimestamp: number): Promise<PartialBlock> {
  const res = await lyra.blockSubgraphClient.request<
    { blocks: { number: string; timestamp: string }[] },
    { startTimestamp: number }
  >(blocksQuery, {
    startTimestamp,
  })
  const block = res.blocks[0]
  return {
    number: parseInt(block.number),
    timestamp: parseInt(block.timestamp),
  }
}
