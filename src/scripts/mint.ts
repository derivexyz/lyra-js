import fromBigNumber from '../utils/fromBigNumber'
import getScriptLyra from './utils/getScriptLyra'

export default async function mint(argv: string[]): Promise<void> {
  const { lyra, signer, wait } = getScriptLyra(argv)
  console.log('minting...', signer.address)
  const tx = await lyra.drip(signer.address)
  if (!tx) {
    throw new Error('Tx rejected')
  }
  const res = await signer.sendTransaction(tx)
  console.log('tx', res.hash)
  await wait(res.hash)
  console.log('minted', signer.address)
  const balances = await lyra.account(signer.address).balances()
  const market = await lyra.market('eth')
  console.log('balances', {
    quote: fromBigNumber(balances.stable(market.quoteToken.address).balance),
    base: fromBigNumber(balances.stable(market.baseToken.address).balance),
  })
}
