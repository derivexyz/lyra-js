import { BigNumber } from '@ethersproject/bignumber'

export default function getBreakEvenPrice(isCall: boolean, strikePrice: BigNumber, optionPrice: BigNumber): BigNumber {
  return isCall ? strikePrice.add(optionPrice) : strikePrice.sub(optionPrice)
}
