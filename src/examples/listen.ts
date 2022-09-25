import yargs from 'yargs'

import getLyra from './utils/getLyra'

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

// Listen to trades
export default async function listen(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    block: { type: 'number', alias: 'b', require: false },
    poll: { type: 'number', alias: 'p', require: false },
  }).argv
  lyra.onTrade(
    trade => {
      console.log({
        trader: trade.trader,
        positionId: trade.positionId,
        market: trade.marketName,
        size: trade.size,
        isBuy: trade.isBuy,
        isLong: trade.isLong,
        premium: trade.premium,
        collateral: trade.collateralValue,
        isLiquidation: trade.isLiquidation,
      })
    },
    {
      startBlockNumber: args.block,
      pollInterval: args.poll,
    }
  )

  // Keep process alive
  await sleep(1 << 30)
}
