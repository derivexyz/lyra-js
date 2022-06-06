import { BigNumber } from '@ethersproject/bignumber'

export default function getBreakEvenPrice(
  isCall: boolean,
  strikePrice: BigNumber,
  optionPrice: BigNumber,
  isBaseCollateral?: boolean
): BigNumber {
  return isCall && !isBaseCollateral ? strikePrice.add(optionPrice) : strikePrice.sub(optionPrice)
}
