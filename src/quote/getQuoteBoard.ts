import { BigNumber } from '@ethersproject/bignumber'

import { Board } from '../board'
import { Option } from '../option'
import { Quote } from '.'

export default function getQuoteBoard(board: Board, size: BigNumber): { bid: Quote; ask: Quote; option: Option }[] {
  const quotes = board.strikes().map(strike => {
    const longCallQuote = Quote.get(strike.option(true), true, size)
    const shortCallQuote = Quote.get(strike.option(true), false, size)
    const longPutQuote = Quote.get(strike.option(false), true, size)
    const shortPutQuote = Quote.get(strike.option(false), false, size)
    return [
      { bid: longCallQuote, ask: shortCallQuote, option: strike.option(true) },
      { bid: longPutQuote, ask: shortPutQuote, option: strike.option(false) },
    ]
  })
  return quotes.flat()
}
