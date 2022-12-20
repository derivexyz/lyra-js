import { BigNumber } from '@ethersproject/bignumber'

import { Version } from '..'
import { UNIT } from '../constants/bn'
import { OptionMarketViewer as OptionMarketViewerAvalon } from '../contracts/avalon/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain'
import { Option } from '../option'
import { getBlackScholesPrice } from '../utils/blackScholes'
import fromBigNumber from '../utils/fromBigNumber'
import getTimeToExpiryAnnualized from '../utils/getTimeToExpiryAnnualized'
import toBigNumber from '../utils/toBigNumber'

export default function getPrice(
  option: Option,
  newBaseIv: BigNumber,
  newSkew: BigNumber
): {
  price: BigNumber
  volTraded: BigNumber
} {
  const timeToExpiryAnnualized = getTimeToExpiryAnnualized(option.board())

  const marketParams = option.market().__marketData.marketParameters
  const rate =
    option.lyra.version === Version.Avalon
      ? (marketParams as OptionMarketViewerAvalon.MarketParametersStructOutput).greekCacheParams.rateAndCarry
      : (option.market().__marketData as OptionMarketViewer.MarketViewWithBoardsStructOutput).rateAndCarry

  const newVol = newBaseIv.mul(newSkew).div(UNIT)

  const spotPrice = option.market().spotPrice
  const strikePrice = option.strike().strikePrice
  const price = toBigNumber(
    getBlackScholesPrice(
      timeToExpiryAnnualized,
      fromBigNumber(newVol),
      fromBigNumber(spotPrice),
      fromBigNumber(strikePrice),
      fromBigNumber(rate),
      option.isCall
    )
  )
  return {
    price,
    volTraded: newVol,
  }
}
