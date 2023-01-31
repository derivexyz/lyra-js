import { PriceType } from './getQuoteSpotPrice'

export default function getPriceType(isCall: boolean, isForceClose: boolean, isBuy: boolean, isOpen: boolean) {
  // LONG_CALL or SHORT_PUT
  if ((isBuy && isCall) || (!isBuy && !isCall)) {
    return isOpen ? PriceType.MAX_PRICE : isForceClose ? PriceType.FORCE_MIN : PriceType.MIN_PRICE
  } else {
    return isOpen ? PriceType.MIN_PRICE : isForceClose ? PriceType.FORCE_MAX : PriceType.MAX_PRICE
  }
}
