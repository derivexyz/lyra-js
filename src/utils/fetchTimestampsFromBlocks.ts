import { gql } from 'graphql-request'

import Lyra from '../lyra'

export type BlockTimestamps = {
  number: number
  timestamp: number
}

const blocksQuery = gql`
  query blocks($blocks: [Int]) {
    blocks(first: 1000, where: { number_in: $blocks }, orderBy: number, orderDirection: asc) {
      number
      timestamp
    }
  }
`

export default async function fetchTimestampsFromBlocks(lyra: Lyra, blocks: number[]): Promise<BlockTimestamps[]> {
  const res = await lyra.blockSubgraphClient.request<
    { blocks: { number: string; timestamp: string }[] },
    { blocks: number[] }
  >(blocksQuery, {
    blocks,
  })
  return res.blocks.map(block => {
    return { number: parseInt(block.number), timestamp: parseInt(block.timestamp) }
  })
}
