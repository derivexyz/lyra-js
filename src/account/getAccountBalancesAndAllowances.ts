import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from '../utils/getLyraContract'
import getMarketAddresses from '../utils/getMarketAddresses'
import { AccountBaseBalance, AccountOptionTokenBalance, AccountStableBalance } from '.'

export default async function getAccountBalancesAndAllowances(
  lyra: Lyra,
  owner: string
): Promise<{
  stables: AccountStableBalance[]
  bases: AccountBaseBalance[]
  optionTokens: AccountOptionTokenBalance[]
}> {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const marketAddresses = (await getMarketAddresses(lyra)).map(m => m.optionMarket)

  const [stableBalances, marketBalances] = await wrapper.getBalancesAndAllowances(owner)

  const stables: AccountStableBalance[] = await Promise.all(
    stableBalances.map(async ({ token: address, balance, allowance, symbol, decimals }) => {
      return {
        address,
        balance,
        allowance,
        symbol,
        decimals,
      }
    })
  )
  const bases: AccountBaseBalance[] = marketBalances.map(
    ({ token: address, symbol, decimals, balance, allowance }, idx) => {
      return {
        marketAddress: marketAddresses[idx],
        address,
        balance,
        allowance,
        symbol,
        decimals,
      }
    }
  )

  const optionTokens: AccountOptionTokenBalance[] = marketBalances.map(({ token: address, isApprovedForAll }, idx) => {
    return {
      marketAddress: marketAddresses[idx],
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
