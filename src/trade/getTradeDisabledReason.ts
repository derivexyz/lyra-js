import { Quote } from '../quote'
import { Trade, TradeDisabledReason } from '.'

// Assume Trade is populated (except for disabled reason)
export default function getTradeDisabledReason(quote: Quote, trade: Trade): TradeDisabledReason | null {
  const position = trade.position()
  if (quote.disabledReason) {
    // Hack: QuoteDisabledReason overlaps with TradeDisabledReason
    const disabledReason = quote.disabledReason as unknown as TradeDisabledReason
    if (
      disabledReason === TradeDisabledReason.EmptySize &&
      position?.collateral &&
      trade.collateral &&
      !trade.collateral.amount.eq(position.collateral.amount)
    ) {
      // Skip disabled flag
    } else {
      return disabledReason
    }
  }

  if (position) {
    if (position.owner !== trade.owner) {
      // Not correct owner
      return TradeDisabledReason.PositionWrongOwner
    } else if (!position.isOpen) {
      // Position is already closed
      return TradeDisabledReason.PositionClosed
    } else if (!trade.isOpen && trade.size.gt(position.size)) {
      // Trying to close more than is open
      return TradeDisabledReason.PositionNotLargeEnough
    } else if (!trade.isOpen && trade.newSize.isZero() && trade.collateral && !trade.collateral.amount.isZero()) {
      // Trying to close completely without removing all collateral
      return TradeDisabledReason.PositionClosedLeftoverCollateral
    }
  }

  if (((trade.isOpen && !trade.isBuy) || (position && !position.isLong)) && !trade.collateral) {
    return TradeDisabledReason.EmptyCollateral
  } else if (trade.newSize.gt(0) && trade.collateral && trade.collateral.amount.lt(trade.collateral.min)) {
    return TradeDisabledReason.NotEnoughCollateral
  } else if (
    trade.newSize.gt(0) &&
    trade.collateral &&
    trade.collateral.max &&
    trade.collateral.amount.gt(trade.collateral.max)
  ) {
    return TradeDisabledReason.TooMuchCollateral
  }

  return null
}
