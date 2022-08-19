import yargs from 'yargs'

import getLyra from './utils/getLyra'

export default async function optionPrice(argv: string[]) {
  const lyra = getLyra()
  /*
    example args: {
      market: 0x1d42a98848e022908069c2c545ae44cc78509bc8
      strikeId: 100
      isCall: true
    }
  */
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    strikeId: { type: 'number', alias: 's', require: true },
    isCall: { type: 'boolean', alias: 'i', require: true },
    timestamp: { type: 'number', alias: 't', require: false },
  }).argv
  const option = await lyra.option(args.market, args.strikeId, args.isCall)
  const prices = await option.priceHistory({
    startTimestamp: args.timestamp,
  })
  console.log(prices.length)
}
