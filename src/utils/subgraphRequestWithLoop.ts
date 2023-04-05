import { DocumentNode } from '@apollo/client/core'

import Lyra from '..'
import { SNAPSHOT_RESULT_LIMIT } from '../constants/queries'
import subgraphRequest from './subgraphRequest'

// GraphQL supports 32 bit signed int, i.e. max 2^31 - 1
const MAX_SAFE_32_BIT_INT = 2147483647

type IteratorVariables = { min: number; max: number; limit?: number }

export default async function subgraphRequestWithLoop<
  Snapshot extends Record<string, any>,
  Variables extends Record<string, any> = Record<string, any>
>(
  lyra: Lyra,
  query: DocumentNode,
  variables: Variables & IteratorVariables,
  iteratorKey: keyof Snapshot,
  batchOptions?: {
    increment: number
    batch: number
  }
): Promise<Snapshot[]> {
  let allFound = false
  let data: Snapshot[] = []
  let min = variables.min
  const limit = variables.limit ?? SNAPSHOT_RESULT_LIMIT

  while (!allFound) {
    const varArr: (Variables & IteratorVariables)[] = []
    if (batchOptions) {
      // when you have absolute min and next min for a query, optimize with batching
      // e.g. querying positions by position ID, absolute min = 0 and next min = 1000
      const { batch, increment } = batchOptions
      for (let b = 0; b < batch; b++) {
        varArr.push({
          ...variables,
          min,
          max: Math.min(min + increment - 1, MAX_SAFE_32_BIT_INT),
        })
        min += increment
      }
    } else {
      varArr.push({
        ...variables,
        limit,
        min,
      })
    }
    const batches = (
      await Promise.all(
        varArr.map(async variables => {
          const { data } = await subgraphRequest<{ [key: string]: Snapshot[] }, Variables & IteratorVariables>(
            lyra.subgraphClient,
            {
              query,
              variables,
            }
          )
          return data
        })
      )
    )
      .filter(res => res != null)
      .map(res => Object.values(res as { [key: string]: Snapshot[] })[0])
    const lastBatch = batches[batches.length - 1]
    data = [...data, ...batches.flat()]
    if (!lastBatch || !lastBatch.length || lastBatch.length < limit) {
      allFound = true
    } else {
      // Set skip to last iterator val
      min = lastBatch[lastBatch.length - 1][iteratorKey] + 1
    }
  }
  return data
}
