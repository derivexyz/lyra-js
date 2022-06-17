import { gql } from 'graphql-request'

import Lyra from '../lyra'

type BlockTimestamps = Record<number, string>

const blocksQuery = gql`
  query blocks($startTimestamp: Int) {
    blocks(first: 1000, where: { timestamp_gte: $startTimestamp }) {
      number
      timestamp
    }
  }
`

export default async function fetchBlocksFromTimestamp(lyra: Lyra, startTimestamp: number): Promise<BlockTimestamps> {
  const res = await lyra.blockSubgraphClient.request<
    { blocks: { number: number; timestamp: number }[] },
    { startTimestamp: number }
  >(blocksQuery, {
    startTimestamp,
  })
  return res.blocks.reduce((dict, { number, timestamp }) => ({ ...dict, [timestamp]: number }), {})
}
