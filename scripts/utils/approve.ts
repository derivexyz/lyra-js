import { Trade, TradeDisabledReason } from '../..'
import { MAX_BN } from '../../src/constants/bn'
import getLyra from './getLyra'
import getSigner from './getSigner'

export default async function approve(trade: Trade): Promise<void> {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  if (trade.disabledReason === TradeDisabledReason.InsufficientQuoteAllowance) {
    console.log('approving quote...')
    const tx = await trade.approveQuote(MAX_BN)
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved quote')
  }

  if (trade.disabledReason === TradeDisabledReason.InsufficientBaseAllowance) {
    console.log('approving base...')
    const tx = await trade.approveBase(MAX_BN)
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved base')
  }
}
