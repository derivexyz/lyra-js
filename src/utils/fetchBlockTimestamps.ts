import { gql } from "graphql-request";

import Lyra from "..";

// TODO: @earthtojake Support queries larger than 1k
const blocksQuery = gql`
  query blocks($blockNumbers: [Int]) {
    blocks(first: 1000, where: { number_in: $blockNumbers }) {
      number
      timestamp
    }
  }
`;

export default async function fetchBlockTimestamps(
  lyra: Lyra,
  blockNumbers: number[]
): Promise<Record<number, number>> {
  // Do not throw on block timestamp queries as they are non-essential
  try {
    const res = await lyra.blockSubgraphClient.request<
      { blocks: { number: number; timestamp: number }[] },
      { blockNumbers: number[] }
    >(blocksQuery, {
      blockNumbers,
    });
    return res.blocks.reduce(
      (dict, { number, timestamp }) => ({ ...dict, [number]: timestamp }),
      {}
    );
  } catch (error) {
    console.error(error);
    console.warn("Failed to query blocks");
    return {};
  }
}
