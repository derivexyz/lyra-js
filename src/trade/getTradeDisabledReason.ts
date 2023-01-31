import { BigNumber } from 'ethers'

import { AccountBalances } from '../account'
import { Position } from '../position'
import { Quote } from '../quote'
import { TradeCollateral, TradeDisabledReason } from '.'

export default function getTradeDisabledReason({
  isOpen,
  owner,
  size,
  newSize,
  quote,
  position,
  collateral,
  balances,
  quoteTransfer,
  baseTransfer,
}: {
  isOpen: boolean
  owner: string
  size: BigNumber
  newSize: BigNumber
  quote: Quote
  position?: Position
  collateral?: TradeCollateral
  balances: AccountBalances
  quoteTransfer: BigNumber
  baseTransfer: BigNumber
}): TradeDisabledReason | null {
  if (quote.disabledReason) {
    // Hack: QuoteDisabledReason overlaps with TradeDisabledReason
    const disabledReason = quote.disabledReason as unknown as TradeDisabledReason
    if (
      disabledReason === TradeDisabledReason.EmptySize &&
      position?.collateral &&
      collateral &&
      !collateral.amount.eq(position.collateral.amount)
    ) {
      // Skip disabled flag for collateral adjustments
    } else if (disabledReason === TradeDisabledReason.EmptyPremium && !isOpen) {
      // Skip disabled flag for empty premium when closing
    } else if (disabledReason === TradeDisabledReason.InsufficientLiquidity && !isOpen) {
      // Skip disabled flag for closing trades with insufficient liquidity
    } else {
      return disabledReason
    }
  }

  if ((position && position.owner !== owner) || balances.owner !== owner) {
    // Not correct owner
    return TradeDisabledReason.IncorrectOwner
  }

  if (position) {
    if (!position.isOpen) {
      // Position is already closed
      return TradeDisabledReason.PositionClosed
    } else if (!isOpen && size.gt(position.size)) {
      // Trying to close more than is open
      return TradeDisabledReason.PositionNotLargeEnough
    } else if (!isOpen && newSize.isZero() && collateral && !collateral.amount.isZero()) {
      // Trying to close completely without removing all collateral
      return TradeDisabledReason.PositionClosedLeftoverCollateral
    }
  }

  if (quoteTransfer.gt(0)) {
    if (balances.quoteAsset.balance.lt(quoteTransfer)) {
      return TradeDisabledReason.InsufficientQuoteBalance
    } else if (balances.quoteAsset.tradeAllowance.lt(quoteTransfer)) {
      return TradeDisabledReason.InsufficientQuoteAllowance
    }
  }

  if (baseTransfer.gt(0)) {
    if (balances.baseAsset.balance.lt(baseTransfer)) {
      return TradeDisabledReason.InsufficientBaseBalance
    } else if (balances.baseAsset.tradeAllowance.lt(baseTransfer)) {
      return TradeDisabledReason.InsufficientBaseAllowance
    }
  }

  if (
    ((isOpen && !quote.isBuy) || (position && !position.isLong)) &&
    (!collateral || (position && !quote.isBuy && newSize.isZero() && collateral.amount.isZero()))
  ) {
    return TradeDisabledReason.EmptyCollateral
  } else if (newSize.gt(0) && collateral && collateral.amount.lt(collateral.min)) {
    return TradeDisabledReason.NotEnoughCollateral
  } else if (newSize.gt(0) && collateral && collateral.max && collateral.amount.gt(collateral.max)) {
    return TradeDisabledReason.TooMuchCollateral
  }

  return null
}
