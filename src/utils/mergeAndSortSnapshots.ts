export default function mergeAndSortSnapshots<T extends { timestamp: number }>(
  snapshots: T[],
  realtimeSnapshot?: T
): T[] {
  if (!realtimeSnapshot) {
    return snapshots.sort((a, b) => a.timestamp - b.timestamp)
  }
  return snapshots
    .filter(s => s.timestamp < realtimeSnapshot.timestamp)
    .concat([realtimeSnapshot])
    .sort((a, b) => a.timestamp - b.timestamp)
}
