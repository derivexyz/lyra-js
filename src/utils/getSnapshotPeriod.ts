import { SnapshotPeriod } from '../constants/queries'
import { SNAPSHOT_RESULT_LIMIT } from './fetchSnapshots'

export default function getSnapshotPeriod(startTimestamp: number, endTimestamp: number): SnapshotPeriod {
  const durationSeconds = Math.max(endTimestamp - startTimestamp, 0)
  const periods = [SnapshotPeriod.FifteenMinutes, SnapshotPeriod.OneHour, SnapshotPeriod.OneDay]
  while (periods.length > 1) {
    const period = periods.shift() as SnapshotPeriod
    const numItems = Math.ceil(durationSeconds / period)
    if (numItems > SNAPSHOT_RESULT_LIMIT) {
      continue
    } else {
      return period
    }
  }
  return periods[0]
}
