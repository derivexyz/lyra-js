import yargs from 'yargs'

import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'

export default async function board(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    board: { type: 'number', alias: 'b', require: true },
  }).argv
  const board = await lyra.board(args.market, args.board)
  console.log({
    id: board.id,
    expiryTimestamp: board.expiryTimestamp,
    isExpired: board.isExpired,
    spotPriceAtExpiry: board.spotPriceAtExpiry ? fromBigNumber(board.spotPriceAtExpiry) : null,
    strikes: board.strikes().map(s => ({
      id: s.id,
      strike: fromBigNumber(s.strikePrice),
      isDeltaInRange: s.isDeltaInRange,
    })),
  })
}
