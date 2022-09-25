export default function getEffectiveTradingFeeRebate(
  stkLyraBalance: number,
  useRebateTable: boolean,
  rebateRateTable: { cutoff: number; returnRate: number }[],
  maxRebatePercentage: number,
  netVerticalStretch: number,
  verticalShift: number,
  vertIntercept: number,
  stretchiness: number
): number {
  if (useRebateTable) {
    return Math.max(...rebateRateTable.filter(x => stkLyraBalance >= x.cutoff).map(x => x.returnRate))
  } else {
    return Math.min(
      maxRebatePercentage,
      vertIntercept + Math.max(0, netVerticalStretch * (verticalShift + Math.log(stkLyraBalance / stretchiness)))
    )
  }
}
