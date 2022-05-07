import yargs from 'yargs'

import getScriptLyra from './utils/getScriptLyra'

export default async function netDeltaHistory(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const netDeltaHistory = await market.netDeltaHistory({})
  console.log(netDeltaHistory)
}
