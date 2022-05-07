import yargs from 'yargs'

import getScriptLyra from './utils/getScriptLyra'

export default async function liquidityHistory(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const liquidityHistory = await market.liquidityHistory({})
  console.log(liquidityHistory)
}
