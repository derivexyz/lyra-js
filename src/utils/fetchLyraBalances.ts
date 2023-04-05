import { BigNumber } from 'ethers'

import { AccountLyraBalances } from '../account'
import Lyra from '../lyra'
import fetchWithCache from './fetchWithCache'
import isTestnet from './isTestnet'

export default async function fetchLyraBalances(lyra: Lyra, owner: string): Promise<AccountLyraBalances> {
  const testnet = isTestnet(lyra)
  const data = await fetchWithCache<{
    mainnetLYRA: string
    opLYRA: string
    opOldStkLYRA: string
    arbitrumLYRA: string
    mainnetStkLYRA: string
    opStkLYRA: string
    arbitrumStkLYRA: string
    stakingAllowance: string
  }>(`${lyra.apiUri}/lyra-balances?&owner=${owner}&testnet=${testnet}`)
  return {
    ethereumLyra: BigNumber.from(data.mainnetLYRA),
    optimismLyra: BigNumber.from(data.opLYRA),
    arbitrumLyra: BigNumber.from(data.arbitrumLYRA),
    optimismOldStkLyra: BigNumber.from(data.opOldStkLYRA),
    ethereumStkLyra: BigNumber.from(data.mainnetStkLYRA),
    optimismStkLyra: BigNumber.from(data.opStkLYRA),
    arbitrumStkLyra: BigNumber.from(data.arbitrumStkLYRA),
    stakingAllowance: BigNumber.from(data.stakingAllowance),
  }
}
