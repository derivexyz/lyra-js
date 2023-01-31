import { Trade } from '../..'
import { MAX_BN } from '../../src/constants/bn'
import getLyra from './getLyra'
import getSigner from './getSigner'

export default async function approve(trade: Trade): Promise<void> {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const account = lyra.account(signer.address)
  const marketBalance = await account.marketBalances(trade.marketAddress)
  const quoteAsset = marketBalance.quoteAsset

  if (quoteAsset.tradeAllowance.isZero()) {
    console.log('approving quote...')
    const tx = await trade.approveQuote(account.address, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve quote')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved quote')
  }

  if (marketBalance.baseAsset.tradeAllowance.isZero()) {
    console.log('approving base...')
    const tx = await trade.approveBase(account.address, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve base')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved base')
  }
}
