import yargs from 'yargs'

import printObject from '../utils/printObject'
import getScriptLyra from './utils/getScriptLyra'

export default async function balances(argv: string[]) {
  const { lyra, signer } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: false },
  }).argv
  const account = lyra.account(args.account ?? signer.address)
  const accountBalances = await account.balances()
  printObject(accountBalances)
}
