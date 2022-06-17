import { AccountStableBalance, Market } from '..'
import Lyra from '../lyra'
import getERC20Contract from '../utils/getERC20Contract'

export default async function getLiquidityDepositBalance(
  lyra: Lyra,
  owner: string,
  market: Market
): Promise<AccountStableBalance> {
  const quoteAddress = market.quoteToken.address
  const liquidityPoolAddress = market.contractAddresses.liquidityPool
  const erc20 = getERC20Contract(lyra.provider, quoteAddress)
  const [allowance, balance] = await Promise.all([erc20.allowance(owner, liquidityPoolAddress), erc20.balanceOf(owner)])
  return {
    ...market.quoteToken,
    allowance,
    balance,
  }
}
