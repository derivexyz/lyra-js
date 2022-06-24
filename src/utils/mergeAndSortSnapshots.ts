export default function mergeAndSortSnapshots<T extends { [key: string]: any }, K extends keyof T>(
  snapshots: T[],
  sortByKey: K,
  realtimeSnapshot?: T
): T[] {
  if (!realtimeSnapshot) {
    return snapshots.sort((a, b) => a[sortByKey] - b[sortByKey])
  }
  return snapshots
    .filter(s => s[sortByKey] < realtimeSnapshot[sortByKey])
    .concat([realtimeSnapshot])
    .sort((a, b) => a[sortByKey] - b[sortByKey])
}
