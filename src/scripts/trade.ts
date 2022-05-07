import { BigNumber } from 'ethers'
import yargs from 'yargs'

import { MAX_BN } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'
import fromBigNumber from '../utils/fromBigNumber'
import getLyraContract from '../utils/getLyraContract'
import printObject from '../utils/printObject'
import toBigNumber from '../utils/toBigNumber'
import approve from './utils/approve'
import getScriptLyra from './utils/getScriptLyra'

// Increase slippage for debugging
const SLIPPAGE = 1 / 100

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

  const trade = Trade.getSync(lyra, owner, option, isBuy, size, {
    setToCollateral,
    isBaseCollateral,
    premiumSlippage: SLIPPAGE,
  })

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
    feeComponents: trade.feeComponents,
    setCollateralTo: trade.collateral
      ? {
          amount: fromBigNumber(trade.collateral.amount),
          min: fromBigNumber(trade.collateral.min),
        }
      : null,
  })

  if (!trade.__params || !trade.tx) {
    console.log('Disabled:', trade.disabledReason)
    return
  }

  trade.tx.gasLimit = BigNumber.from(10_000_000)

  // Uncomment to read premium + fees from contracts
  const optionMarketWrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const ret = await optionMarketWrapper.connect(signer).callStatic.openPosition({
    ...trade.__params,
    maxCost: MAX_BN,
    minCost: 0,
  })
  console.log('Wrapper:', {
    premium: fromBigNumber(ret.totalCost),
    fees: fromBigNumber(ret.totalFee),
  })

  const response = await signer.sendTransaction(trade.tx)
  const receipt = await response.wait()
  console.log('tx', receipt.transactionHash)
  const tradeEvent = TradeEvent.getByLogsSync(lyra, market, receipt.logs)[0]

  printObject('Result', {
    positionId: tradeEvent.positionId,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
    feeComponents: tradeEvent.feeComponents,
    setCollateralTo: tradeEvent.setCollateralTo,
  })
}
