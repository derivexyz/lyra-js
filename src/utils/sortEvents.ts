export type SortEventOptions = {
  isDescending?: boolean
}

// Default chronological ascending sort (least to most recent)
export default function sortEvents<T extends { blockNumber: number; logIndex?: number }>(
  events: T[],
  options?: SortEventOptions
): T[] {
  const isDescending = !!options?.isDescending
  return [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex != null && b.logIndex != null
        ? isDescending
          ? b.logIndex - a.logIndex
          : a.logIndex - b.logIndex
        : 0
      : isDescending
      ? b.blockNumber - a.blockNumber
      : a.blockNumber - b.blockNumber
  )
}
