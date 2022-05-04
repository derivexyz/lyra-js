// Chronological ascending sort (least to most recent)
export default function sortEvents<T extends { blockNumber: number; logIndex: number }>(events: T[]): T[] {
  return [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber - b.blockNumber
  )
}
