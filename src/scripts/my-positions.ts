import yargs from 'yargs'

import fromBigNumber from '../utils/fromBigNumber'
import getScriptLyra from './utils/getScriptLyra'

export default async function myPositions(argv: string[]) {
  const { lyra, signer } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: false },
  }).argv
  const positions = await lyra.positions(args.account ?? signer.address)
  console.log(
    positions.map(pos => ({
      __source: pos.__source,
      id: pos.id,
      size: fromBigNumber(pos.size),
      isOpen: pos.isOpen,
    }))
  )
}
