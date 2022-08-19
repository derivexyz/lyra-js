export default function getEffectiveTradingFeeRebate(
  stkLyraBalance: number,
  maxRebatePercentage: number,
  netVerticalStretch: number,
  verticalShift: number,
  vertIntercept: number,
  stretchiness: number
): number {
  return Math.min(
    maxRebatePercentage,
    vertIntercept + Math.max(0, netVerticalStretch * (verticalShift + Math.log(stkLyraBalance / stretchiness)))
  )
}
