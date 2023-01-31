import { MAX_BN, ONE_BN } from '../src/constants/bn'
import { Trade } from '../src/trade'
import { TradeEvent } from '../src/trade_event'
import printObject from '../src/utils/printObject'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function simpleTrade() {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const account = lyra.account(signer.address)

  const market = await lyra.market('eth')

  // Select most recent expiry
  const board = market.liveBoards()[0]

  // Select first strike in delta range
  const strike = board.strikes().find(strike => strike.isDeltaInRange)
  if (!strike) {
    throw new Error('No strike in delta range')
  }

  // Prepare trade (Open 1.0 Long ETH Call)
  const trade = await Trade.get(lyra, account.address, 'eth', strike.id, true, true, ONE_BN.div(100), {
    slippage: 0.1 / 100, // 0.1%
  })

  // Approve
  const approveTx = await trade.approveQuote(account.address, MAX_BN)
  const approveResponse = await signer.sendTransaction(approveTx)
  await approveResponse.wait()
  console.log('Approved sUSD')

  // Check if trade is disabled
  if (trade.disabledReason) {
    throw new Error(`Trade is disabled: ${trade.disabledReason}`)
  }

  // Execute trade
  const tradeResponse = await signer.sendTransaction(trade.tx)
  console.log('Executed trade:', tradeResponse.hash)
  const tradeReceipt = await tradeResponse.wait()

  // Get trade result
  const tradeEvent = (await TradeEvent.getByHash(lyra, tradeReceipt.transactionHash))[0]

  printObject('Trade Result', {
    blockNumber: tradeEvent.blockNumber,
    positionId: tradeEvent.positionId,
    premium: tradeEvent.premium,
    fee: tradeEvent.fee,
  })
}
