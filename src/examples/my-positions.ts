import yargs from 'yargs'

import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function myPositions(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)
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
