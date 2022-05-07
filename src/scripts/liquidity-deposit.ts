import yargs from 'yargs'

import getScriptLyra from './utils/getScriptLyra'

export default async function liquidityDeposit(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    owner: { type: 'string', alias: 'o', require: true },
  }).argv
  const liquidityDeposits = await lyra.liquidityDeposits(args.market, args.owner)
  console.log(liquidityDeposits)
}
