import getScriptLyra from './utils/getScriptLyra'

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

// Listen to trades
export default async function listen(argv: string[]) {
  const { lyra } = getScriptLyra(argv)

  lyra.onTrade(trade => {
    console.log({
      trader: trade.trader,
      positionId: trade.positionId,
      market: trade.marketName,
      size: trade.size,
      isBuy: trade.isBuy,
      isLong: trade.isLong,
      premium: trade.premium,
      setCollateralTo: trade.setCollateralTo,
      isLiquidation: trade.isLiquidation,
    })
  })

  // Keep process alive
  await sleep(1 << 30)
}
