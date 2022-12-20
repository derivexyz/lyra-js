import yargs from 'yargs'

import { UNIT, ZERO_BN } from '../constants/bn'
import fromBigNumber from '../src/utils/fromBigNumber'
import toBigNumber from '../src/utils/toBigNumber'
import { TradeEvent } from '../trade_event'
import approve from './utils/approve'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'
import printObject from './utils/printObject'

// Increase slippage for debugging
const SLIPPAGE = 0.1 / 100

export default async function positionTrade(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const args = await yargs(argv).options({
    id: { type: 'number', alias: 'i', require: true },
    size: { type: 'number', alias: 's', require: false },
    isBuy: { type: 'boolean', alias: 'b', require: true },
    collat: { type: 'number', require: false },
    market: { type: 'string', alias: 'm', require: true },
    max: { type: 'boolean', require: false },
  }).argv

  const positionId = args.id
  const isMax = !!args.max
  const _size = toBigNumber(args.size ?? 0)
  const isBuy = !!args.isBuy
  const _collateral = args.collat != null ? toBigNumber(args.collat) : undefined
  const market = await lyra.market(args.market)
  const position = await lyra.position(args.market, positionId)

  const isOpen = (position.isLong && isBuy) || (!position.isLong && !isBuy)

  const size = !isOpen && isMax ? position.size : _size
  const setToCollateral = !position.isLong && !isOpen && isMax ? ZERO_BN : _collateral

  console.log(
    `${isBuy ? 'Buying' : 'Selling'} to ${isOpen ? 'Open' : 'Close'} ${fromBigNumber(size)} ${
      !isOpen ? `/ ${fromBigNumber(position.size)}` : ''
    } ${market.name} ${position.isCall ? 'Calls' : 'Puts'} ( setCollateralTo = ${fromBigNumber(
      position.collateral?.amount ?? ZERO_BN
    )} -> ${fromBigNumber(setToCollateral ?? ZERO_BN)} )`
  )

  // TODO: @michaelxuwu Update to include multiple stables
  await approve(market, market.quoteToken.address)

  const trade = await position.trade(isBuy, size, SLIPPAGE, {
    setToCollateral,
  })

  if (!trade.__params) {
    console.log('something is broken')
    return
  }

  printObject('Quote', {
    premium: trade.quoted,
    fee: trade.fee,
    feeComponents: trade.feeComponents,
    forceClosePenalty: trade.forceClosePenalty,
    quoteToken: trade.quoteToken,
    baseToken: trade.baseToken,
    collateral: trade.collateral,
  })

  if (trade.disabledReason) {
    console.log('disabled:', trade.disabledReason)
    return
  }

  const response = await signer.sendTransaction(trade.tx)
  const receipt = await response.wait()
  console.log('tx', response.hash)
  const [tradeEvent] = await TradeEvent.getByHash(lyra, receipt.transactionHash)

  printObject('Result', {
    positionId: tradeEvent.positionId,
    trader: tradeEvent.trader,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
    feeComponents: tradeEvent.feeComponents,
    collateral: tradeEvent.collateralValue,
  })

  console.log('Slippage', 100 * (fromBigNumber(trade.quoted.mul(UNIT).div(tradeEvent.premium)) - 1), '%')
}
