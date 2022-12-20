import yargs from 'yargs'

import getLyra from './utils/getLyra'

export default async function liquidityDeposits(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    owner: { type: 'string', alias: 'o', require: true },
  }).argv
  const liquidityDeposits = await lyra.liquidityDeposits(args.market, args.owner)
  console.log(liquidityDeposits)
}
