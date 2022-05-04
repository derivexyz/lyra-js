import { OptionType } from '../constants/contracts'

export default function getIsCall(optionType: OptionType) {
  return [OptionType.LongCall, OptionType.ShortCoveredCall, OptionType.ShortCall].includes(optionType)
}
