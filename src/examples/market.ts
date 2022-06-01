import yargs from 'yargs'

import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'

async function main() {
  await market(["--market", "sETH"]);
}

export default async function market(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  console.log(args);
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

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });