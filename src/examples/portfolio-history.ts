import yargs from 'yargs'

import { SECONDS_IN_DAY } from '../constants/time'
import getLyra from './utils/getLyra'

export default async function portfolioHistory(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: true },
  }).argv
  const account = lyra.account(args.account)
  const block = await lyra.provider.getBlock('latest')
  const history = await account.portfolioHistory(block.timestamp - SECONDS_IN_DAY * 30)
  // printObject(history)
}
