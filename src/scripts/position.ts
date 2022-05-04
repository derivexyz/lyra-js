import yargs from 'yargs'

import printObject from '../utils/printObject'
import getScriptLyra from './utils/getScriptLyra'

export default async function position(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    id: { type: 'string', alias: 'i', require: true },
  }).argv
  const position = await lyra.position(args.market, parseInt(args.id))
  printObject('Position', {
    __source: position.__source,
    owner: position.owner,
    isOpen: position.isOpen,
    isLong: position.isLong,
    size: position.size,
    trades: position.trades().map(trade => ({
      size: trade.size,
      pricePerOption: trade.pricePerOption,
      premium: trade.premium,
      isBuy: trade.isBuy,
      isOpen: trade.isOpen,
      isLiquidation: trade.isLiquidation,
      setCollateralTo: trade.setCollateralTo,
    })),
    collateralUpdates: position
      .collateralUpdates()
      .filter(c => c.isAdjustment)
      .map(collatUpdates => ({
        setCollateralTo: collatUpdates.setCollateralTo,
      })),
    avgCost: position.averageCostPerOption(),
    collateral: position.collateral,
  })
}
