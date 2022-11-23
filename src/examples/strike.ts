import yargs from 'yargs'
import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'
import { ONE_BN } from '../constants/bn'

export default async function board(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    strikeId: { type: 'number', alias: 's', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const strike = await market.strike(args.strikeId)
  const quoteLongCall = await strike.quote(true, true, ONE_BN)
  const quoteShortCall = await strike.quote(true, false, ONE_BN)
  const quoteLongPut = await strike.quote(false, true, ONE_BN)
  const quoteShortPut = await strike.quote(false, false, ONE_BN)

  console.log({
    market:market.baseToken.symbol,
    strike:fromBigNumber(strike.strikePrice),
    size: fromBigNumber(quoteLongCall.size),
  })
  console.log({
    side:"CALL",
    bidIv:fromBigNumber(quoteShortCall.iv.mul(100)).toFixed(2),
    bid: fromBigNumber(quoteShortCall.pricePerOption).toFixed(2),
    ask: fromBigNumber(quoteLongCall.pricePerOption).toFixed(2),
    askIv:fromBigNumber(quoteLongCall.iv.mul(100)).toFixed(2),
  })
  console.log({
    side:"PUT",
    bidIv:fromBigNumber(quoteShortPut.iv.mul(100)).toFixed(2),
    bid: fromBigNumber(quoteShortPut.pricePerOption).toFixed(2),
    ask: fromBigNumber(quoteLongPut.pricePerOption).toFixed(2),
    askIv:fromBigNumber(quoteLongPut.iv.mul(100)).toFixed(2),
  })
}
