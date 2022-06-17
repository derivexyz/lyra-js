import { SnapshotPeriod } from '../constants/queries'

export default function getSnapshotPeriod(
  startTimestamp: number,
  endTimestamp: number,
  includeFifteenMinutes = false
): SnapshotPeriod {
  const durationSeconds = Math.max(endTimestamp - startTimestamp, 0)

  const periods = includeFifteenMinutes
    ? [SnapshotPeriod.FifteenMinutes, SnapshotPeriod.OneHour, SnapshotPeriod.OneDay]
    : [SnapshotPeriod.OneHour, SnapshotPeriod.OneDay]

  while (periods.length > 1) {
    const period = periods.shift() as SnapshotPeriod
    const numItems = Math.ceil(durationSeconds / period)
    if (numItems > 1000) {
      continue
    } else {
      return period
    }
  }
  return periods[0]
}
