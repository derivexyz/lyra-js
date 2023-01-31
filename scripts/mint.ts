import printObject from '../src/utils/printObject'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function mint(argv: string[]): Promise<void> {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  console.log('minting...', signer.address)
  const tx = await lyra.drip(signer.address)
  const res = await signer.sendTransaction(tx)
  console.log('tx', res.hash)
  await res.wait()
  console.log('minted', signer.address)
  const balances = await lyra.account(signer.address).balances()
  printObject('balances', balances)
}
