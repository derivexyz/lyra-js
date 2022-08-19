export default function getEffectiveLiquidityTokens(
  lpTokens: number,
  totalLpTokens: number,
  stkLyra: number,
  totalStkLyra: number,
  x: number
): number {
  return totalStkLyra > 0
    ? Math.min(x * lpTokens + (((1 - x) * stkLyra) / totalStkLyra) * totalLpTokens, lpTokens)
    : lpTokens
}
