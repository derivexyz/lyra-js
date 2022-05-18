import yargs from 'yargs'

import { MAX_BN } from '../constants/bn'
import toBigNumber from '../utils/toBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function initiateDeposit(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const args = await yargs(argv).options({
    beneficiary: { type: 'string', alias: 'b', require: true },
    marketAddressOrName: { type: 'string', alias: 'm', require: true },
    amountQuote: { type: 'number', alias: 'a', require: true },
  }).argv

  const beneficiary = args.beneficiary
  const marketAddressOrName = args.marketAddressOrName
  const amountQuote = toBigNumber(args.amountQuote)
  const account = lyra.account(args.beneficiary ?? signer.address)
  const approveTx = await account.approveDeposit(marketAddressOrName, MAX_BN)
  const approveResponse = await signer.sendTransaction(approveTx)
  await approveResponse.wait()
  console.log('Approved sUSD')
  const deposit = await lyra.deposit(beneficiary, marketAddressOrName, amountQuote)
  if (deposit) {
    const response = await signer.sendTransaction(deposit)
    const receipt = await response.wait()
    console.log('tx', receipt.transactionHash)
  }
}
