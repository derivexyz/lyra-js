import yargs from 'yargs'

import { ZERO_BN } from '../constants/bn'
import getLyra from './utils/getLyra'

export default async function marketPoolStats(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const tradingVolumeHistory = await market.tradingVolumeHistory()
  const tradingVolume = tradingVolumeHistory.reduce(
    (sum, tradingVolume) => sum.add(tradingVolume.notionalVolume),
    ZERO_BN
  )
  const totalFees = tradingVolumeHistory.reduce(
    (sum, tradingVolume) =>
      sum
        .add(tradingVolume.deltaCutoffFees)
        .add(tradingVolume.liquidatorFees)
        .add(tradingVolume.lpLiquidationFees)
        .add(tradingVolume.optionPriceFees)
        .add(tradingVolume.smLiquidationFees)
        .add(tradingVolume.spotPriceFees)
        .add(tradingVolume.vegaFees),
    ZERO_BN
  )
  const openInterest = market.openInterest
  console.log({
    tradingVolume,
    totalFees,
    openInterest,
  })
}
