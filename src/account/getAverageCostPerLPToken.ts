import { BigNumber } from '@ethersproject/bignumber'

import { LiquidityDeposit, LiquidityWithdrawal } from '..'
import { UNIT, ZERO_BN } from '../constants/bn'

export default function getAverageCostPerLPToken(
  liquidityDeposits: LiquidityDeposit[],
  liquidityWithdrawals: LiquidityWithdrawal[]
): BigNumber {
  const deposits = liquidityDeposits
    .filter(deposit => !deposit.isPending && deposit.balance)
    .map(deposit => {
      return {
        isDeposit: true,
        timestamp: deposit.depositTimestamp,
        value: deposit.value,
        balance: deposit.balance ?? ZERO_BN,
      }
    })
  const withdrawals = liquidityWithdrawals
    .filter(withdrawal => !withdrawal.isPending && withdrawal.value)
    .map(withdrawal => {
      return {
        isDeposit: false,
        timestamp: withdrawal.withdrawalTimestamp,
        value: withdrawal.value ?? ZERO_BN,
        balance: withdrawal.balance,
      }
    })
  const depositsAndWithdrawals = [...deposits, ...withdrawals].sort((a, b) => a.timestamp - b.timestamp)
  const { averageTokenPrice } = depositsAndWithdrawals.reduce(
    (profitAndLoss, event) => {
      const { balance: prevBalance, averageTokenPrice: prevAverageTokenPrice } = profitAndLoss
      const { isDeposit, value, balance } = event
      const newTotalTokenAmount = isDeposit ? prevBalance.add(balance) : prevBalance.sub(balance)
      const prevTotalTokenValue = prevBalance.mul(prevAverageTokenPrice).div(UNIT)
      const totalTokenValue = prevTotalTokenValue.add(value)
      const averageTokenPrice =
        isDeposit && newTotalTokenAmount.gt(0)
          ? totalTokenValue.mul(UNIT).div(newTotalTokenAmount)
          : prevAverageTokenPrice
      return {
        averageTokenPrice,
        balance: newTotalTokenAmount,
      }
    },
    {
      averageTokenPrice: ZERO_BN,
      balance: ZERO_BN,
    }
  )
  return averageTokenPrice
}
