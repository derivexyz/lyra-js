import { OptionType } from '../constants/contracts'
import getIsLong from './getIsLong'

export default function getIsBuy(optionType: OptionType, isOpen: boolean) {
  const isLong = getIsLong(optionType)
  return (isLong && isOpen) || (!isLong && !isOpen)
}
