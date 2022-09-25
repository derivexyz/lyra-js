import Lyra from '..'
import { MAX_END_TIMESTAMP, MIN_START_TIMESTAMP } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import getSnapshotPeriod from './getSnapshotPeriod'
import subgraphRequestWithLoop from './subgraphRequestWithLoop'

export default async function fetchSnapshots<
  Snapshot extends Record<string, any>,
  Variables extends Record<string, any>
>(lyra: Lyra, query: string, variables: Variables, options?: SnapshotOptions): Promise<Snapshot[]> {
  const min = options?.startTimestamp ?? MIN_START_TIMESTAMP
  const max = options?.endTimestamp ?? MAX_END_TIMESTAMP
  const period = options?.period ?? getSnapshotPeriod(min, max)
  return subgraphRequestWithLoop<Snapshot, Variables>(lyra, query, { ...variables, min, max, period }, 'timestamp')
}
