export default function getUniqueBy<T extends any>(array: T[], by: (item: T) => any): T[] {
  return array.filter((value: T, index: number, self: T[]) => {
    return self.findIndex(item => by(item) === by(value)) === index
  }) as T[]
}
