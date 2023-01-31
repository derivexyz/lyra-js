import { BigNumber } from 'ethers'

import { LyraMarketContractId } from '../constants/contracts'
import Lyra from '../lyra'
import callContractWithMulticall from '../utils/callContractWithMulticall'
import getERC20Contract from '../utils/getERC20Contract'
import getLyraMarketContract from '../utils/getLyraMarketContract'
import { AccountBalances } from '.'

export default async function fetchAccountBalancesAndAllowances(lyra: Lyra, owner: string): Promise<AccountBalances[]> {
  const markets = await lyra.markets()

  return await Promise.all(
    markets.map(async market => {
      const quoteToken = getERC20Contract(lyra.provider, market.quoteToken.address)
      const baseToken = getERC20Contract(lyra.provider, market.baseToken.address)
      const optionMarket = getLyraMarketContract(
        lyra,
        market.contractAddresses,
        lyra.version,
        LyraMarketContractId.OptionMarket
      )
      const liquidityPool = getLyraMarketContract(
        lyra,
        market.contractAddresses,
        lyra.version,
        LyraMarketContractId.LiquidityPool
      )
      const liquidityToken = getLyraMarketContract(
        lyra,
        market.contractAddresses,
        lyra.version,
        LyraMarketContractId.LiquidityToken
      )

      const [
        [quoteSymbol],
        [quoteDecimals],
        [quoteBalance],
        [quoteTradeAllowance],
        [quoteDepositAllowance],
        [baseSymbol],
        [baseDecimals],
        [baseBalance],
        [baseTradeAllowance],
        [liquidityBalance],
      ] = await callContractWithMulticall<
        [
          [string],
          [number],
          [BigNumber],
          [BigNumber],
          [BigNumber],
          [string],
          [number],
          [BigNumber],
          [BigNumber],
          [BigNumber]
        ]
      >(lyra, [
        {
          callData: quoteToken.interface.encodeFunctionData('symbol'),
          contract: quoteToken,
          functionFragment: 'symbol',
        },
        {
          callData: quoteToken.interface.encodeFunctionData('decimals'),
          contract: quoteToken,
          functionFragment: 'decimals',
        },
        {
          callData: quoteToken.interface.encodeFunctionData('balanceOf', [owner]),
          contract: quoteToken,
          functionFragment: 'balanceOf',
        },
        {
          callData: quoteToken.interface.encodeFunctionData('allowance', [owner, optionMarket.address]),
          contract: quoteToken,
          functionFragment: 'allowance',
        },
        {
          callData: quoteToken.interface.encodeFunctionData('allowance', [owner, liquidityPool.address]),
          contract: quoteToken,
          functionFragment: 'allowance',
        },
        {
          callData: baseToken.interface.encodeFunctionData('symbol'),
          contract: baseToken,
          functionFragment: 'symbol',
        },
        {
          callData: baseToken.interface.encodeFunctionData('decimals'),
          contract: baseToken,
          functionFragment: 'decimals',
        },
        {
          callData: baseToken.interface.encodeFunctionData('balanceOf', [owner]),
          contract: baseToken,
          functionFragment: 'balanceOf',
        },
        {
          callData: baseToken.interface.encodeFunctionData('allowance', [owner, optionMarket.address]),
          contract: baseToken,
          functionFragment: 'allowance',
        },
        {
          callData: liquidityToken.interface.encodeFunctionData('balanceOf', [owner]),
          contract: liquidityToken,
          functionFragment: 'balanceOf',
        },
      ])

      return {
        owner,
        market,
        marketAddress: market.address,
        marketName: market.name,
        quoteAsset: {
          address: quoteToken.address,
          balance: quoteBalance,
          symbol: quoteSymbol,
          decimals: quoteDecimals,
          tradeAllowance: quoteTradeAllowance,
          depositAllowance: quoteDepositAllowance,
        },
        baseAsset: {
          address: baseToken.address,
          symbol: baseSymbol,
          decimals: baseDecimals,
          balance: baseBalance,
          tradeAllowance: baseTradeAllowance,
        },
        liquidityToken: {
          address: liquidityToken.address,
          symbol: `${market.baseToken.symbol}LP`,
          balance: liquidityBalance,
          decimals: 18,
        },
      }
    })
  )
}
