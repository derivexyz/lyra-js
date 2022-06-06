import yargs from 'yargs'

import printObject from '../utils/printObject'
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
    owner: position.owner,
    isOpen: position.isOpen,
    isCall: position.isCall,
    isLong: position.isLong,
    isSettled: position.isSettled,
    isLiquidated: position.isLiquidated,
    size: position.sizeBeforeClose(),
    strikePrice: position.strikePrice,
    breakEven: position.breakEven(),
    avgCost: position.avgCostPerOption(),
    pricePerOption: position.pricePerOption,
    realizedPnl: position.realizedPnl(),
    realizedPnlPercent: position.realizedPnlPercent(),
    unrealizedPnl: position.unrealizedPnl(),
    unrealizedPnlPercent: position.unrealizedPnlPercent(),
    isInTheMoney: position.isInTheMoney,
    trades: position.trades().map(trade => ({
      hash: trade.transactionHash,
      size: trade.size,
      cost: trade.premium,
      isBuy: trade.isBuy,
      isOpen: trade.isOpen,
      newAvgCostPerOption: trade.newAvgCostPerOptionSync(position),
      realizedPnl: trade.realizedPnlSync(position),
      realizedPnlPercent: trade.realizedPnlPercentSync(position),
      setCollateralTo: trade.setCollateralTo,
    })),
    transfers: position.transfers().map(t => ({
      from: t.from,
      to: t.to,
    })),
    collateral: position.collateral,
  })
}
