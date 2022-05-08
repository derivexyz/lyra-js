import { MAX_BN } from '../../constants/bn'
import { Market } from '../../market'
import { ScriptLyra } from './getScriptLyra'

export default async function approve(
  { lyra, signer }: ScriptLyra,
  market: Market,
  stableToken: string
): Promise<void> {
  const account = lyra.account(signer.address)
  const balances = await account.balances()

  if (balances.stable(stableToken).allowance.isZero()) {
    console.log('approving quote...')
    const tx = await account.approveStableToken(stableToken, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve quote')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved quote')
  }

  if (balances.base(market.address).allowance.isZero()) {
    console.log('approving base...')
    const tx = await account.approveBaseToken(market.address, MAX_BN)
    if (!tx) {
      throw new Error('Cannot approve base')
    }
    const response = await signer.sendTransaction(tx)
    await response.wait()
    console.log('approved base')
  }

  if (!balances.optionToken(market.address).isApprovedForAll) {
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
