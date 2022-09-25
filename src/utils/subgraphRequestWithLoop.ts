import Lyra from '..'
import { SNAPSHOT_RESULT_LIMIT } from '../constants/queries'

type IteratorVariables = { min: number; max: number }

export default async function subgraphRequestWithLoop<
  Snapshot extends Record<string, any>,
  Variables extends Record<string, any> = Record<string, any>
>(
  lyra: Lyra,
  query: string,
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
          max: min + increment - 1,
        })
        min += increment
      }
    } else {
      varArr.push({
        ...variables,
        min,
      })
    }
    const batches = (
      await Promise.all(
        varArr.map(vars =>
          lyra.subgraphClient.request<{ [key: string]: Snapshot[] }, Variables & IteratorVariables>(query, vars)
        )
      )
    ).map(res => Object.values(res)[0])
    const lastBatch = batches[batches.length - 1]
    data = [...data, ...batches.flat()]
    if (!lastBatch.length || lastBatch.length < SNAPSHOT_RESULT_LIMIT) {
      allFound = true
    } else {
      // Set skip to last iterator val
      min = lastBatch[lastBatch.length - 1][iteratorKey] + 1
    }
  }
  return data
}
