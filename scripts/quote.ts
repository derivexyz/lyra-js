import { ONE_BN } from '../src/constants/bn'
import fromBigNumber from '../src/utils/fromBigNumber'
import getLyra from './utils/getLyra'

export default async function quote(argv: string[]) {
  const lyra = getLyra()
  const data = await lyra.markets()
  const market = data[0]
  const strike = market.liveBoards()[0].strikes()[1]
  const quote = await strike.quote(true, false, ONE_BN.div(100))
  console.log({
    size: fromBigNumber(quote.size),
    pricePerOption: fromBigNumber(quote.pricePerOption),
    premium: fromBigNumber(quote.premium),
    fee: quote.fee,
  })
}
