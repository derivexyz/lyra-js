import { to18DecimalBN } from '../utils/convertBNDecimals'
import fromBigNumber from '../utils/fromBigNumber'
import getLyra from './utils/getLyra'
import getSigner from './utils/getSigner'

export default async function market(argv: string[]) {
  const lyra = getLyra()
  const signer = getSigner(lyra)

  const owner = signer.address
  const account = lyra.account(owner)
  const balances = await account.balances()
  const stableBalances = balances.stables.reduce((balances, token) => {
    if (token.symbol === 'usdc') {
      return {
        ...balances,
        [token.address]: fromBigNumber(to18DecimalBN(token.balance, token.decimals)),
      }
    }
    return {
      ...balances,
      [token.address]: fromBigNumber(token.balance),
    }
  }, {} as { [stable: string]: number })
  console.log(stableBalances)
}
