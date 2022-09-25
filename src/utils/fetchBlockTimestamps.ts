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

export default async function fetchBlockTimestamps(
  lyra: Lyra,
  blockNumbers: number[]
): Promise<Record<number, number>> {
  const res = await lyra.blockSubgraphClient.request<
    { blocks: { number: string; timestamp: string }[] },
    { blocks: number[] }
  >(blocksQuery, {
    blocks: blockNumbers,
  })
  return res.blocks.reduce((blocks, block) => {
    return { ...blocks, [block.number]: parseInt(block.timestamp) }
  }, {})
}
