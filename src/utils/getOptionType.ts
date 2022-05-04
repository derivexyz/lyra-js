import { OptionType } from '../constants/contracts'

export default function getOptionType(isCall: boolean, isLong: boolean, isBaseCollateral: boolean) {
  if (isCall) {
    return isLong ? OptionType.LongCall : isBaseCollateral ? OptionType.ShortCoveredCall : OptionType.ShortCall
  } else {
    return isLong ? OptionType.LongPut : OptionType.ShortPut
  }
}
