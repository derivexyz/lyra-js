import yargs from 'yargs'

import getLyra from './utils/getLyra'

export default async function rewardEpoch(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: true },
  }).argv
  const rewardEpoch = await lyra.rewardEpochs(args.account)
  console.log(rewardEpoch)
}
