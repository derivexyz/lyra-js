import yargs from 'yargs'

import printObject from '../src/utils/printObject'
import getLyra from './utils/getLyra'

export default async function position(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
    id: { type: 'string', alias: 'i', require: true },
  }).argv
  const position = await lyra.position(args.market, parseInt(args.id))
  printObject('Position', {
    __source: position.__source,
    marketAddress: position.marketAddress,
    owner: position.owner,
    isOpen: position.isOpen,
    isCall: position.isCall,
    isLong: position.isLong,
    isSettled: position.isSettled,
    isLiquidated: position.isLiquidated,
    size: position.sizeBeforeClose(),
    strikePrice: position.strikePrice,
    breakEven: position.breakEven(),
    avgCost: position.averageCostPerOption(),
    pricePerOption: position.pricePerOption,
    isInTheMoney: position.isInTheMoney,
    trades: position.trades().map(trade => ({
      hash: trade.transactionHash,
      size: trade.size,
      cost: trade.premium,
      isBuy: trade.isBuy,
      isOpen: trade.isOpen,
      collateral: trade.collateralValue,
    })),
    collatUpdates: position.collateralUpdates().map(collatUpdate => ({
      hash: collatUpdate.transactionHash,
      amount: collatUpdate.amount,
      value: collatUpdate.value,
    })),
    collateral: position.collateral,
    settle: {
      hash: position.settle()?.transactionHash,
      settlement: position.settle()?.settlement,
      returnedCollateralValue: position.settle()?.returnedCollateralValue,
    },
    pnl: position.pnl(),
  })
}
