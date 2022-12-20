import { ZERO_BN } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import { OptionMarketViewer as OptionMarketViewerAvalon } from '../contracts/avalon/typechain'
import { OptionMarketViewer } from '../contracts/newport/typechain'
import Lyra, { Version } from '../lyra'
import getLyraContract from '../utils/getLyraContract'
import { AccountBalances } from '.'

type LiquidityBalanceStructOutput =
  | OptionMarketViewer.LiquidityBalanceStructOutput
  | OptionMarketViewerAvalon.LiquidityBalanceAndAllowanceStructOutput

export default async function fetchAccountBalancesAndAllowances(lyra: Lyra, owner: string): Promise<AccountBalances[]> {
  const wrapper = getLyraContract(lyra, LyraContractId.OptionMarketWrapper)
  const viewer = getLyraContract(lyra, LyraContractId.OptionMarketViewer)
  const [markets, [stableBalances, marketBalances]] = await Promise.all([
    lyra.markets(),
    wrapper.getBalancesAndAllowances(owner),
  ])

  const liquidityBalances: LiquidityBalanceStructOutput[] =
    lyra.version === Version.Avalon
      ? await (viewer as OptionMarketViewerAvalon).getLiquidityBalancesAndAllowances(
          markets.map(market => market.address),
          owner
        )
      : await (viewer as OptionMarketViewer).getLiquidityBalances(owner)

  return markets.map((market, idx) => {
    const quoteBalance = stableBalances.find(stable => stable.token === market.quoteToken.address)
    const baseBalance = marketBalances.find(base => base.market === market.address)
    const _liquidityBalance = liquidityBalances[idx]
    if (!quoteBalance || !baseBalance || !_liquidityBalance) {
      throw new Error(`No balance found for market: ${market.name}`)
    }
    let depositAllowance, liquidityTokenAddress, liquidityTokenBalance
    if (lyra.version === Version.Avalon) {
      const avalonLiquidityBalance =
        _liquidityBalance as OptionMarketViewerAvalon.LiquidityBalanceAndAllowanceStructOutput
      depositAllowance = avalonLiquidityBalance.allowance
      liquidityTokenAddress = avalonLiquidityBalance.token
      liquidityTokenBalance = avalonLiquidityBalance.balance
    } else {
      const liquidityBalance = _liquidityBalance as OptionMarketViewer.LiquidityBalanceStructOutput
      depositAllowance = liquidityBalance.quoteDepositAllowance
      liquidityTokenAddress = liquidityBalance.liquidityToken
      liquidityTokenBalance = liquidityBalance.liquidityBalance
    }
    return {
      marketAddress: market.address,
      marketName: market.name,
      quoteAsset: {
        address: quoteBalance.token,
        balance: quoteBalance.balance,
        symbol: quoteBalance.symbol,
        decimals: quoteBalance.decimals,
        id: quoteBalance.id,
        tradeAllowance: quoteBalance.allowance,
        depositAllowance,
      },
      baseAsset: {
        address: baseBalance.token,
        symbol: baseBalance.symbol,
        decimals: baseBalance.decimals,
        balance: baseBalance.balance,
        tradeAllowance: baseBalance.allowance,
        id: baseBalance.id,
      },
      // Includes quoteAsset
      quoteSwapAssets: stableBalances.map(stableToken => {
        const stableLiquidityBalance = liquidityBalances.find(
          liquidityBalance =>
            ('quoteAsset' in liquidityBalance && liquidityBalance.quoteAsset === stableToken.token) ||
            ('token' in liquidityBalance && liquidityBalance.token === stableToken.token)
        )
        return {
          address: stableToken.token,
          balance: stableToken.balance,
          symbol: stableToken.symbol,
          decimals: stableToken.decimals,
          id: stableToken.id,
          tradeAllowance: stableToken.allowance,
          depositAllowance:
            stableLiquidityBalance && 'quoteDepositAllowance' in stableLiquidityBalance
              ? stableLiquidityBalance.quoteDepositAllowance
              : stableLiquidityBalance?.allowance ?? ZERO_BN,
        }
      }),
      optionToken: {
        address: baseBalance.token,
        isApprovedForAll: baseBalance.isApprovedForAll,
        id: baseBalance.id,
      },
      liquidityToken: {
        address: liquidityTokenAddress,
        symbol: `Ly${market.name}LP`,
        balance: liquidityTokenBalance,
        decimals: quoteBalance.decimals,
      },
    }
  })
}
