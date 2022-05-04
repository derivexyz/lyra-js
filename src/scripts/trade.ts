import yargs from 'yargs'

import Trade from '../trade'
import TradeEvent from '../trade_event'
import fromBigNumber from '../utils/fromBigNumber'
import printObject from '../utils/printObject'
import toBigNumber from '../utils/toBigNumber'
import approve from './utils/approve'
import getScriptLyra from './utils/getScriptLyra'

// Increase slippage for debugging
const SLIPPAGE = 0.1 / 100

export default async function trade(argv: string[]) {
  const { lyra, signer } = getScriptLyra(argv)

  const args = await yargs(argv).options({
    amount: { type: 'number', alias: 'a', require: true },
    call: { type: 'boolean', alias: 'c', require: true },
    buy: { type: 'boolean', alias: 'b', require: true },
    market: { type: 'string', alias: 'm', require: true },
    strike: { type: 'number', alias: 's', require: true },
    collat: { type: 'number', require: false },
    base: { type: 'boolean', require: false },
  }).argv

  const size = toBigNumber(args.amount)
  const isCall = !!args.call
  const isBuy = !!args.buy
  const setToCollateral = args.collat ? toBigNumber(args.collat) : undefined
  const strikeId = args.strike
  const marketAddressOrName = args.market
  const isBaseCollateral = args.base

  const owner = signer.address
  const market = await lyra.market(marketAddressOrName)
  const option = market.liveOption(strikeId, isCall)

  console.log(
    `${isBuy ? 'Buying' : 'Selling'} ${args.amount} ${market.name} ${isCall ? 'Calls' : 'Puts'} for $${fromBigNumber(
      option.strike().strikePrice
    )} strike, ${option.board().expiryTimestamp} expiry`
  )

  // TODO: @michaelxuwu Update to include multiple stables
  await approve({ lyra, signer }, market, market.quoteToken.address)

  const trade = await Trade.get(lyra, owner, marketAddressOrName, strikeId, isCall, isBuy, size, {
    setToCollateral,
    isBaseCollateral,
    premiumSlippage: SLIPPAGE,
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
  //   strike.strikePrice,
  //   BigNumber.from(strike.board().expiryTimestamp),
  //   market.spotPrice,
  //   size
  // )
  // console.log({ contractMinCollat: fromBigNumber(shortCollat) })

  printObject('Quote', {
    premium: trade.quoted,
    fee: trade.fee,
    collateral: trade.collateral
      ? {
          amount: fromBigNumber(trade.collateral.amount),
          min: fromBigNumber(trade.collateral.min),
        }
      : null,
  })

  // Uncomment to read premium + fees from contracts
  // const optionMarketWrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  // const ret = await optionMarketWrapper.connect(signer).callStatic.openPosition({
  //   ...trade.__params,
  //   // Ensure slippage is acceptable for testing quote
  //   maxCost: BigNumber.from(trade.__params.maxCost).mul(5),
  //   stableAmount: BigNumber.from(trade.__params.stableAmount).mul(5),
  // })
  // console.log('wrapper:', {
  //   premium: fromBigNumber(ret.totalCost),
  //   fees: fromBigNumber(ret.totalFee),
  // })

  if (!trade.tx) {
    console.log('Disabled:', trade.disabledReason)
    return
  }

  const response = await signer.sendTransaction(trade.tx)
  const receipt = await response.wait()
  console.log('tx', receipt.transactionHash)
  const tradeEvent = TradeEvent.getByReceiptSync(lyra, market, receipt, Date.now())

  printObject('Result', {
    positionId: tradeEvent.positionId,
    trader: tradeEvent.trader,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
    setCollateralTo: tradeEvent.setCollateralTo,
  })
}
