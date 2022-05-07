import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from '../utils/getLyraContract'
import getMarketAddresses from '../utils/getMarketAddresses'
import { AccountBaseBalance, AccountLPTokenBalance, AccountOptionTokenBalance, AccountStableBalance } from '.'

export default async function getAccountBalancesAndAllowances(
  lyra: Lyra,
  owner: string
): Promise<{
  stables: AccountStableBalance[]
  bases: AccountBaseBalance[]
  optionTokens: AccountOptionTokenBalance[]
  liquidityTokens: AccountLPTokenBalance[]
}> {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const optionMarketViewer = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketViewer)

  const marketAddresses = (await getMarketAddresses(lyra)).map(m => m.optionMarket)

  const [[stableBalances, marketBalances], liquidityTokenBalances] = await Promise.all([
    wrapper.getBalancesAndAllowances(owner),
    // TODO: @earthtojake Remove markets parameter from getLiquidityBalancesAndAllowances
    optionMarketViewer.getLiquidityBalancesAndAllowances(marketAddresses, owner),
  ])

  const liquidityTokens = liquidityTokenBalances.map((liquidityTokenBalance, idx) => {
    return {
      marketAddress: marketAddresses[idx],
      address: liquidityTokenBalance.token,
      balance: liquidityTokenBalance.balance,
      // TODO: @earthtojake Add symbol and decimals to getLiquidityBalancesAndAllowances
      symbol: 'LyLP',
      decimals: 18,
    }
  })

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
    liquidityTokens,
  }
}
