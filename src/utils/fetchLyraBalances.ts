import { BigNumber } from 'ethers'

import { AccountLyraBalances } from '../account'
import Lyra from '../lyra'
import fetchWithCache from './fetchWithCache'

export default async function fetchLyraBalances(lyra: Lyra, owner: string): Promise<AccountLyraBalances> {
  const data = await fetchWithCache<{
    mainnetLYRA: string
    opLYRA: string
    opOldStkLYRA: string
    arbitrumLYRA: string
    mainnetStkLYRA: string
    opStkLYRA: string
    arbitrumStkLYRA: string
    migrationAllowance: string
    stakingAllowance: string
  }>(`${lyra.apiUri}/lyra-balances?&owner=${owner}`)
  return {
    ethereumLyra: BigNumber.from(data.mainnetLYRA),
    optimismLyra: BigNumber.from(data.opLYRA),
    arbitrumLyra: BigNumber.from(data.arbitrumLYRA),
    optimismOldStkLyra: BigNumber.from(data.opOldStkLYRA),
    ethereumStkLyra: BigNumber.from(data.mainnetStkLYRA),
    optimismStkLyra: BigNumber.from(data.opStkLYRA),
    arbitrumStkLyra: BigNumber.from(data.arbitrumStkLYRA),
    migrationAllowance: BigNumber.from(data.migrationAllowance),
    stakingAllowance: BigNumber.from(data.stakingAllowance),
  }
}
