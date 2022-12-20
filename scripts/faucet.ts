import fromBigNumber from '../src/utils/fromBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function faucet() {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const preAccount = lyra.account(signer.address)
  const ethBalance = await signer.getBalance()
  const balances = await preAccount.balances()
  const stables = await preAccount.quoteAssets()
  if (stables.every(stableToken => stableToken.balance.isZero())) {
    console.log('minting...', signer.address)
    const tx = await lyra.drip(signer.address)
    if (!tx) {
      throw new Error('Tx rejected')
    }
    const res = await signer.sendTransaction(tx)
    console.log('tx', res.hash)
    await res.wait()
    console.log('minted', signer.address)
  } else {
    console.log('already minted', signer.address)
  }
  const newBalances = await lyra.account(signer.address).quoteAssets()
  console.log('balances', {
    eth: fromBigNumber(ethBalance),
    quote: newBalances.map(stable => ({
      ...stable,
      balance: fromBigNumber(stable.balance, stable.decimals),
    })),
    base: balances.map(balance => ({
      ...balance.baseAsset,
      balance: fromBigNumber(balance.baseAsset.balance, balance.baseAsset.decimals),
    })),
  })
}
