import yargs from 'yargs'

import fromBigNumber from '../src/utils/fromBigNumber'
import printObject from '../src/utils/printObject'
import getLyra from './utils/getLyra'

export default async function myPositions(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: true },
    open: { type: 'boolean', alias: 'o', require: false },
  }).argv
  const isOpen = args.open
  const account = args.account
  const positions = isOpen ? await lyra.openPositions(account) : await lyra.positions(account)
  printObject(
    positions.map(pos => ({
      __source: pos.__source,
      id: pos.id,
      size: pos.size,
      isOpen: pos.isOpen,
      isCall: pos.isCall,
      isLong: pos.isLong,
      isSettled: pos.isSettled,
      isBaseCollateral: pos.collateral?.isBase,
      numTrades: pos.trades().length,
      avgCostPerOption: pos.averageCostPerOption(),
      pricePerOption: pos.pricePerOption,
      collateral: pos.collateral,
      pnl: pos.pnl(),
      strikeId: pos.strikeId,
      strike: fromBigNumber(pos.strikePrice),
    }))
  )
}
