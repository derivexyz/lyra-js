import yargs from 'yargs'

import printObject from '../utils/printObject'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function myPositions(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const args = await yargs(argv).options({
    account: { type: 'string', alias: 'a', require: false },
    open: { type: 'boolean', alias: 'o', require: false },
  }).argv
  const isOpen = args.open
  const account = args.account ?? signer.address
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
      avgCostPerOption: pos.avgCostPerOption(),
      pricePerOption: pos.pricePerOption,
      realizedPnl: pos.realizedPnl(),
      realizedPnlPercent: pos.realizedPnlPercent(),
      unrealizedPnl: pos.unrealizedPnl(),
      unrealizedPnlPercent: pos.unrealizedPnlPercent(),
    }))
  )
}
