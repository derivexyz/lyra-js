import { BigNumber } from 'ethers'

import { LYRA_API_URL } from '../constants/links'
import fetchWithCache from './fetchWithCache'

export type LyraBalancesData = {
  mainnetLYRA: BigNumber
  opLYRA: BigNumber
  opOldStkLYRA: BigNumber
  mainnetStkLYRA: BigNumber
  opStkLYRA: BigNumber
}

export default async function fetchLyraBalances(owner: string): Promise<LyraBalancesData> {
  const data = await fetchWithCache(`${LYRA_API_URL}/lyra-balances?&owner=${owner}`)
  return {
    mainnetLYRA: BigNumber.from(data.mainnetLYRA),
    opLYRA: BigNumber.from(data.opLYRA),
    opOldStkLYRA: BigNumber.from(data.opOldStkLYRA),
    mainnetStkLYRA: BigNumber.from(data.mainnetStkLYRA),
    opStkLYRA: BigNumber.from(data.opStkLYRA),
  }
}
