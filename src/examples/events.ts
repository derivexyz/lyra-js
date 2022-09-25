import yargs from 'yargs'

import printObject from '../utils/printObject'
import getLyra from './utils/getLyra'

export default async function events(argv: string[]): Promise<void> {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    hash: { type: 'string', alias: 'h', require: true },
  }).argv
  // Add test code here
  const { trades, collateralUpdates, settles, transfers } = await lyra.events(args.hash)
  printObject({
    trades: trades.map(trade => ({
      marketName: trade.marketName,
      positionId: trade.positionId,
      trader: trade.trader,
      size: trade.size,
      collateral: trade.collateralValue,
      isBuy: trade.isBuy,
      isLong: trade.isLong,
      isLiquidation: trade.isLiquidation,
      pricePerOption: trade.pricePerOption,
      premium: trade.premium,
    })),
    collateralUpdates: collateralUpdates.map(collateralUpdate => ({
      marketName: collateralUpdate.marketName,
      positionId: collateralUpdate.positionId,
      amount: collateralUpdate.amount,
      value: collateralUpdate.value,
    })),
    settles: settles.map(settle => ({
      marketName: settle.marketName,
      positionId: settle.positionId,
      settlement: settle.settlement,
    })),
    transfers,
  })
}
