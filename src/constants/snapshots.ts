import { SnapshotPeriod } from './queries'

export type SnapshotOptions = {
  startTimestamp?: number
  endTimestamp?: number
  period?: SnapshotPeriod
}
