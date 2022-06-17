import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function faucet() {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const preAccount = lyra.account(signer.address)
  const balances = await preAccount.balances()
  if (balances.base('sETH').balance.isZero() || balances.stables.every(stableToken => stableToken.balance.isZero())) {
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
  const newBalances = await lyra.account(signer.address).balances()
  console.log('balances', {
    quote: newBalances.stables,
    base: fromBigNumber(newBalances.base('sETH').balance),
  })
}
