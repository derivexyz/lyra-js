import { AccountTokenBalance } from '../account'

export default function isTokenEqual<T extends AccountTokenBalance>(token: T, tokenAddressOrName: string): boolean {
  return (
    token.address.toLowerCase() === tokenAddressOrName.toLowerCase() ||
    token.symbol.toLowerCase() === tokenAddressOrName.toLowerCase()
  )
}
