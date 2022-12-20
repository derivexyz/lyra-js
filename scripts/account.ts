import { to18DecimalBN } from '../src/utils/convertBNDecimals'
import fromBigNumber from '../src/utils/fromBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function market(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const owner = signer.address
  const account = lyra.account(owner)
  const balances = await account.quoteAssets()
  const ethBalance = await signer.getBalance()
  const stableBalances = balances.reduce((balances, token) => {
    if (token.symbol === 'usdc') {
      return {
        ...balances,
        [token.symbol]: fromBigNumber(to18DecimalBN(token.balance, token.decimals)),
      }
    }
    return {
      ...balances,
      [token.symbol]: fromBigNumber(token.balance),
    }
  }, {} as { [stable: string]: number })
  console.log({ ...stableBalances, ETH: fromBigNumber(ethBalance) })
}
