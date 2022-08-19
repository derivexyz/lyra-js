export default function getTradingFeeRebate(
  maxRebate: number,
  a: number,
  b: number,
  c: number,
  d: number,
  stkLyra: number
): number {
  return d > 0 ? Math.min(maxRebate, c + Math.max(0, a * (b + Math.log(stkLyra / d)))) : 0
}
