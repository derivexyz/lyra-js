import Lyra from '..'
import { LyraContractId } from '../constants/contracts'
import Market from '../market'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraContract from '../utils/getLyraContract'
import { AccountBaseBalance, AccountOptionTokenBalance, AccountStableBalance } from '.'

export default async function getAccountBalancesAndAllowances(
  lyra: Lyra,
  owner: string,
  markets: Market[]
): Promise<{
  stables: AccountStableBalance[]
  bases: AccountBaseBalance[]
  optionTokens: AccountOptionTokenBalance[]
}> {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)

  const [stableBalances, marketBalances] = await wrapper.getBalancesAndAllowances(
    markets.map(market => market.address),
    owner
  )

  const stables: AccountStableBalance[] = await Promise.all(
    stableBalances.map(async ({ token: address, balance, allowance }) => {
      const erc20 = getERC20Contract(lyra.provider, address)
      const [decimals, symbol] = await Promise.all([erc20.decimals(), erc20.symbol()])
      return {
        address,
        balance,
        allowance,
        symbol,
        decimals,
      }
    })
  )
  const bases: AccountBaseBalance[] = marketBalances.map(({ token: address, balance, allowance }, idx) => {
    return {
      marketAddress: markets[idx].address,
      address,
      balance,
      allowance,
      symbol: markets[idx].baseToken.symbol,
      decimals: 18,
    }
  })

  const optionTokens: AccountOptionTokenBalance[] = marketBalances.map(({ token: address, isApprovedForAll }, idx) => {
    return {
      marketAddress: markets[idx].address,
      address,
      isApprovedForAll,
    }
  })

  return {
    stables,
    bases,
    optionTokens,
  }
}
