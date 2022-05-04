import fromBigNumber from '../utils/fromBigNumber'
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
      market: trade.marketName,
      marketAddress: trade.marketAddress,
      positionId: trade.positionId,
      trader: trade.trader,
      size: fromBigNumber(trade.size),
      setCollateralTo: trade.setCollateralTo ? fromBigNumber(trade.setCollateralTo) : undefined,
      isBuy: trade.isBuy,
      isLong: trade.isLong,
      isLiquidation: trade.isLiquidation,
      pricePerOption: fromBigNumber(trade.pricePerOption),
      premium: fromBigNumber(trade.premium),
      lpFees: trade.liquidation ? fromBigNumber(trade.liquidation.lpFee) : undefined,
    })
  })

  // Keep process alive
  await sleep(1 << 30)
}
