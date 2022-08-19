import yargs from 'yargs'

import { SECONDS_IN_DAY } from '../constants/time'
import getLyra from './utils/getLyra'

export default async function tradingVolume(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const tradingVolumeHistory = await market.tradingVolumeHistory({
    startTimestamp: market.block.timestamp - SECONDS_IN_DAY * 7,
  })
}
