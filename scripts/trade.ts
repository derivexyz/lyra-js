import yargs from 'yargs'

import { UNIT } from '../constants/bn'
import fromBigNumber from '../src/utils/fromBigNumber'
import toBigNumber from '../src/utils/toBigNumber'
import { Trade } from '../trade'
import { TradeEvent } from '../trade_event'
import approve from './utils/approve'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'
import printObject from './utils/printObject'

// Increase slippage for debugging
const SLIPPAGE = 0.1 / 100

export default async function trade(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const args = await yargs(argv).options({
    amount: { type: 'number', alias: 'a', require: true },
    call: { type: 'boolean', alias: 'c', require: true },
    buy: { type: 'boolean', alias: 'b', require: true },
    market: { type: 'string', alias: 'm', require: true },
    strike: { type: 'number', alias: 's', require: true },
    quote: { type: 'string', alias: 'q', require: false },
    collat: { type: 'number', require: false },
    base: { type: 'boolean', require: false },
    stable: { type: 'string', require: false },
  }).argv

  const marketAddressOrName = args.market
  const marketBalance = await lyra.account(signer.address).marketBalances(marketAddressOrName)
  const quoteToken = args.quote
    ? await lyra.account(signer.address).quoteAsset(marketAddressOrName, args.quote)
    : marketBalance.quoteAsset
  const size = toBigNumber(args.amount)
  const isCall = !!args.call
  const isBuy = !!args.buy
  const setToCollateral = args.collat ? toBigNumber(args.collat, quoteToken.decimals) : undefined
  const strikeId = args.strike
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
  await approve(market, market.quoteToken.address)

  const trade = await Trade.get(lyra, owner, market.address, option.strike().id, option.isCall, isBuy, size, {
    setToCollateral,
    isBaseCollateral,
    premiumSlippage: SLIPPAGE,
    inputAsset: {
      address: quoteToken.address,
      decimals: quoteToken.decimals,
    },
  })

  printObject('Quote', {
    timestamp: trade.board().block.timestamp,
    blockNumber: trade.board().block.number,
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

  if (trade.disabledReason) {
    console.log('Disabled:', trade.disabledReason)
    return
  }

  const response = await signer.sendTransaction(trade.tx)
  const receipt = await response.wait()
  console.log('tx', receipt.transactionHash)
  const [tradeEvent] = await TradeEvent.getByHash(lyra, receipt.transactionHash)

  printObject('Result', {
    timestamp: tradeEvent.timestamp,
    blockNumber: tradeEvent.blockNumber,
    positionId: tradeEvent.positionId,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
    feeComponents: tradeEvent.feeComponents,
    collateral: tradeEvent.collateralValue,
  })

  console.log('Slippage', 100 * (fromBigNumber(trade.quoted.mul(UNIT).div(tradeEvent.premium)) - 1), '%')
}
