export default function filterNulls<TValue>(array: (TValue | null | undefined)[]): TValue[] {
  return array.filter((val: TValue | null | undefined) => val !== null && val !== undefined) as TValue[]
}
