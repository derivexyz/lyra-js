import yargs from 'yargs'

import { ZERO_BN } from '../src/constants/bn'
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
  const openInterest = market.openInterest
  console.log({
    tradingVolume,
    openInterest,
  })
}
