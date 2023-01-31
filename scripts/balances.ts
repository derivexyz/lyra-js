import yargs from 'yargs'

import printObject from '../src/utils/printObject'
import getLyra from './utils/getLyra'

export default async function balances(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: true },
  }).argv
  const account = lyra.account(args.account)
  const balances = await account.marketBalances('eth')
  printObject(balances)
}
