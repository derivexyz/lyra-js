import yargs from 'yargs'

import toBigNumber from '../utils/toBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function initiateWithdraw(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)
  const args = await yargs(argv).options({
    beneficiary: { type: 'string', alias: 'b', require: true },
    marketAddressOrName: { type: 'string', alias: 'm', require: true },
    tokenAddressOrName: { type: 'string', alias: 't', require: true },
    amountLiquidityTokens: { type: 'number', alias: 'a', require: true },
  }).argv

  const beneficiary = args.beneficiary
  const marketAddressOrName = args.marketAddressOrName
  const amountLiquidityTokens = toBigNumber(args.amountLiquidityTokens)
  // no approval is needed
  const market = await lyra.market(marketAddressOrName)
  const withdraw = await market.withdraw(beneficiary, marketAddressOrName, amountLiquidityTokens)
  if (withdraw) {
    const response = await signer.sendTransaction(withdraw)
    const receipt = await response.wait()
    console.log('tx', receipt.transactionHash)
  }
}
