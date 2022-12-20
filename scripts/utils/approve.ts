import { MAX_BN } from '../../constants/bn'
import { Market } from '../../market'
import getLyra from './getLyra'
import getSigner from './getSigner'

export default async function approve(market: Market, stableToken: string): Promise<void> {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const account = lyra.account(signer.address)
  const marketBalance = await account.marketBalances(market.address)
  const quoteAsset = await account.quoteAsset(market.address, stableToken)

  if (quoteAsset.tradeAllowance.isZero()) {
    console.log('approving quote...')
    const tx = await account.approveStableToken(stableToken, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve quote')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved quote')
  }

  if (marketBalance.baseAsset.tradeAllowance.isZero()) {
    console.log('approving base...')
    const tx = await account.approveBaseToken(market.address, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve base')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved base')
  }

  if (!marketBalance.optionToken.isApprovedForAll) {
    console.log('approving option token...')
    const tx = await account.approveOptionToken(market.address, true)
    if (!tx) {
      throw new Error('Cannot approve option token')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved option token')
  }
}
