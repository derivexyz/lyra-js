import Lyra from '..'
import { SnapshotPeriod } from '../constants/queries'

export const SNAPSHOT_RESULT_LIMIT = 1000

type TimeVariables = { startTimestamp: number; endTimestamp: number; period: SnapshotPeriod }

export default async function fetchSnapshots<
  Snapshot extends { timestamp: number },
  Variables extends Record<string, any>
>(lyra: Lyra, query: string, key: string, variables: Variables & TimeVariables): Promise<Snapshot[]> {
  let allFound = false
  let data: Snapshot[] = []
  let startTimestamp = variables.startTimestamp
  while (!allFound) {
    const vars = {
      ...variables,
      startTimestamp,
    }
    const res = await lyra.subgraphClient.request<{ [key: string]: Snapshot[] }, Variables & TimeVariables>(query, vars)
    const newData = res[key]
    data = [...data, ...newData]
    if (!newData.length || newData.length < SNAPSHOT_RESULT_LIMIT) {
      allFound = true
    } else {
      // Set skip to last timestamp
      startTimestamp = newData[newData.length - 1].timestamp + 1
    }
  }
  return data
}
