import { UNIT, ZERO_BN } from '../constants/bn'
import { Position, PositionPnl } from '.'

export default function getPositionPnl(position: Position): PositionPnl {
  const trades = position.trades()
  const closingTrades = trades.filter(trade => !trade.isOpen)
  const settle = position.settle()

  // Avg. premiums paid / received for open or settled portion of position
  const totalAverageOpenCost = position.averageCostPerOption().mul(position.size).div(UNIT)

  // Avg. premiums paid / received for closed portion of position
  const totalAverageCloseCost = closingTrades.reduce((sum, closeTrade) => {
    // Use average cost per option before closing trade
    const averageOpenPremiums = closeTrade.prevAverageCostPerOption(position).mul(closeTrade.size).div(UNIT)
    return sum.add(averageOpenPremiums)
  }, ZERO_BN)

  // Total premiums received for closed portion of position
  const totalClosePremiums = closingTrades.reduce((sum, closeTrade) => sum.add(closeTrade.premium), ZERO_BN)

  if (position.isLong) {
    let unrealizedPnl = ZERO_BN
    let unrealizedPnlPercentage = ZERO_BN
    if (position.isOpen) {
      const positionFairValue = position.pricePerOption.mul(position.size).div(UNIT)
      // Open position fair value minus premiums paid
      unrealizedPnl = positionFairValue.sub(totalAverageOpenCost)
      unrealizedPnlPercentage = totalAverageOpenCost.gt(0) ? unrealizedPnl.mul(UNIT).div(totalAverageOpenCost) : ZERO_BN
    }

    // Realized premium profits from closes
    const realizedPnl = totalClosePremiums.sub(totalAverageCloseCost)
    const realizedPnlPercentage = totalAverageCloseCost.gt(0)
      ? realizedPnl.mul(UNIT).div(totalAverageCloseCost)
      : ZERO_BN

    let settlementPnl = ZERO_BN
    let settlementPnlPercentage = ZERO_BN
    if (settle) {
      // Settlement pnl is cash settled minus premiums paid
      const settlementValue = settle.settlement
      settlementPnl = settlementValue.sub(totalAverageOpenCost)
      settlementPnlPercentage = totalAverageOpenCost.gt(0) ? settlementPnl.mul(UNIT).div(totalAverageOpenCost) : ZERO_BN
    }

    return {
      totalAverageOpenCost,
      totalAverageCloseCost,
      unrealizedPnl,
      unrealizedPnlPercentage,
      realizedPnl,
      realizedPnlPercentage,
      settlementPnl,
      settlementPnlPercentage,
    }
  } else {
    let unrealizedPnl = ZERO_BN
    let unrealizedPnlPercentage = ZERO_BN
    if (position.isOpen) {
      const positionFairValue = position.pricePerOption.mul(position.size).div(UNIT)

      // Open position premiums received minus fair value
      unrealizedPnl = totalAverageOpenCost.sub(positionFairValue)
      unrealizedPnlPercentage = totalAverageOpenCost.gt(0) ? unrealizedPnl.mul(UNIT).div(totalAverageOpenCost) : ZERO_BN
    }

    // Realized profits from premiums on close
    const realizedPnl = totalAverageCloseCost.sub(totalClosePremiums)

    const realizedPnlPercentage = totalAverageCloseCost.gt(0)
      ? realizedPnl.mul(UNIT).div(totalAverageCloseCost)
      : ZERO_BN

    let settlementPnl = ZERO_BN
    let settlementPnlPercentage = ZERO_BN
    if (settle) {
      const lockedCollateralAmount = position.collateral?.amount ?? ZERO_BN // Always > 0
      const spotPriceAtExpiry = settle.spotPriceAtExpiry
      const settlementAmount = settle.returnedCollateralAmount
      const lostCollateralAmount = lockedCollateralAmount.sub(settlementAmount) // E.g. locked 5 sETH, returned 3 sETH, lost 2 sETH
      const lostCollateralValue = settle.isBaseCollateral
        ? lostCollateralAmount.mul(spotPriceAtExpiry).div(UNIT) // E.g. Sold 2 sETH to cover cash-settled obligation on expriy
        : lostCollateralAmount
      settlementPnl = totalAverageOpenCost.sub(lostCollateralValue)
      settlementPnlPercentage = totalAverageOpenCost.gt(0) ? settlementPnl.mul(UNIT).div(totalAverageOpenCost) : ZERO_BN
    }

    return {
      totalAverageOpenCost,
      totalAverageCloseCost,
      unrealizedPnl,
      unrealizedPnlPercentage,
      realizedPnl,
      realizedPnlPercentage,
      settlementPnl,
      settlementPnlPercentage,
    }
  }
}
