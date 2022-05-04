import { MAX_BN, ONE_BN } from '../constants/bn'
import Trade from '../trade'
import TradeEvent from '../trade_event'
import printObject from '../utils/printObject'
import getScriptLyra from './utils/getScriptLyra'

export default async function simpleTrade(argv: string[]) {
  const { lyra, signer } = getScriptLyra(argv)

  const account = lyra.account(signer.address)

  const market = await lyra.market('eth')

  // Select most recent expiry
  const board = market.liveBoards()[0]

  // Select first strike in delta range
  const strike = board.strikes().find(strike => strike.isDeltaInRange)
  if (!strike) {
    throw new Error('No strike in delta range')
  }

  // Approve
  const approveTx = await account.approveStableToken(market.quoteToken.address, MAX_BN)
  const approveResponse = await signer.sendTransaction(approveTx)
  await approveResponse.wait()

  // Prepare trade (Open 1.0 Long ETH Call)
  const trade = await Trade.get(lyra, account.address, 'eth', strike.id, true, true, ONE_BN, {
    premiumSlippage: 0.1 / 100, // 0.1%
  })

  // Check if trade is disabled
  if (!trade.tx) {
    throw new Error(`Trade is disabled: ${trade.disabledReason}`)
  }

  // Execute trade
  const tradeResponse = await signer.sendTransaction(trade.tx)
  const tradeReceipt = await tradeResponse.wait()

  // Get trade result
  const tradeEvent = await TradeEvent.getByHash(lyra, tradeReceipt.transactionHash)

  printObject('Trade Result', {
    positionId: tradeEvent.positionId,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
  })
}
