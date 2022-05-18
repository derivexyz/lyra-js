import yargs from 'yargs'

import getLyra from './utils/getLyra'

export default async function tradingVolumeHistory(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const tradingVolumeHistory = await market.tradingVolumeHistory({})
  console.log(tradingVolumeHistory)
}
