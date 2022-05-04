import yargs from 'yargs'

import fromBigNumber from '../utils/fromBigNumber'
import getScriptLyra from './utils/getScriptLyra'

export default async function market(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  console.log({
    address: market.address,
    name: market.name,
    strikes: market
      .liveBoards()
      .map(board =>
        board.strikes().map(strike => ({
          boardId: board.id,
          strikeId: strike.id,
          expiryTimestamp: board.expiryTimestamp,
          strikePrice: fromBigNumber(strike.strikePrice),
          isDeltaInRange: strike.isDeltaInRange,
        }))
      )
      .flat(),
  })
}
