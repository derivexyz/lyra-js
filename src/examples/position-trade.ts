import yargs from 'yargs'

import { UNIT, ZERO_BN } from '../constants/bn'
import { TradeEvent } from '../trade_event'
import fromBigNumber from '../utils/fromBigNumber'
import printObject from '../utils/printObject'
import toBigNumber from '../utils/toBigNumber'
import approve from './utils/approve'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

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

  // Uncomment to read min collateral from contracts
  // const greekCache = getLyraMarketContract(
  //   lyra.provider,
  //   market.__marketData.marketAddresses,
  //   LyraMarketContractId.OptionGreekCache
  // )
  // const shortCollat = await greekCache.getMinCollateral(
  //   trade.__params.optionType,
  //   position.strikePrice,
  //   BigNumber.from(position.expiryTimestamp),
  //   market.spotPrice,
  //   trade.newSize
  // )
  // console.log({ contractMinCollat: fromBigNumber(shortCollat), newSize: fromBigNumber(trade.newSize) })

  printObject('Quote', {
    premium: trade.quoted,
    fee: trade.fee,
    feeComponents: trade.feeComponents,
    forceClosePenalty: trade.forceClosePenalty,
    quoteToken: trade.quoteToken,
    baseToken: trade.baseToken,
    collateral: trade.collateral,
  })

  // Uncomment to read premium + fees from contracts
  // const optionMarketWrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  // const ret = await optionMarketWrapper.connect(signer).callStatic.closePosition(
  //   {
  //     ...trade.__params,
  //     minCost: toBigNumber(20),
  //     stableAmount: toBigNumber(20),
  //   },
  //   { blockTag: trade.market().block.number }
  // )
  // console.log('contract quote', {
  //   premium: fromBigNumber(ret.totalCost),
  //   base: fromBigNumber(ret.totalCost.sub(ret.totalFee)),
  //   totalFee: fromBigNumber(ret.totalFee),
  // })

  if (trade.disabledReason) {
    console.log('disabled:', trade.disabledReason)
    return
  }

  const response = await signer.sendTransaction(trade.tx)
  const receipt = await response.wait()
  console.log('tx', response.hash)
  const tradeEvent = TradeEvent.getByLogsSync(lyra, market, receipt.logs)[0]

  printObject('Result', {
    positionId: tradeEvent.positionId,
    trader: tradeEvent.trader,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
    feeComponents: tradeEvent.feeComponents,
    setCollateralTo: tradeEvent.setCollateralTo,
  })

  console.log('Slippage', 100 * (fromBigNumber(trade.quoted.mul(UNIT).div(tradeEvent.premium)) - 1), '%')
}
