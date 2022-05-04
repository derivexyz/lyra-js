import { OptionType } from '../constants/contracts'

export default function getIsLong(optionType: OptionType) {
  return [OptionType.LongCall, OptionType.LongPut].includes(optionType)
}
