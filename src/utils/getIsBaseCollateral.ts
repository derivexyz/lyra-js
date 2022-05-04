import { OptionType } from '../constants/contracts'

export default function getIsBaseCollateral(optionType: OptionType) {
  return optionType === OptionType.ShortCoveredCall
}
