import yargs from 'yargs'

import { TradeEvent } from '../trade_event'
import fromBigNumber from '../utils/fromBigNumber'
import getScriptLyra from './utils/getScriptLyra'

export default async function tradeEvent(argv: string[]): Promise<void> {
  const { lyra } = getScriptLyra(argv)
  const args = await yargs(argv).options({
    hash: { type: 'string', alias: 'h', require: true },
  }).argv
  // Add test code here
  const trades = await TradeEvent.getByHash(lyra, args.hash)
  console.log(
    trades.map(trade => ({
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
    }))
  )
}
