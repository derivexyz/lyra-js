import { ONE_BN } from '../constants/bn'
import fromBigNumber from '../utils/fromBigNumber'
import getScriptLyra from './utils/getScriptLyra'

export default async function quote(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
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
