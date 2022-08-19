import Lyra, { Deployment } from '../lyra'
import fetchURL from './fetchURL'

const ACCOUNT_URL = '/stake/accountRewards'
const ACCOUNT_EPOCH_CACHE_LIFE = 60
const ACCOUNT_EPOCH_CACHE: Record<string, { epoch: Promise<AccountRewardEpochData[]>; lastUpdated: number }> = {}

export type AccountRewardEpochData = {
  account: string //indexed,
  deployment: string // indexed
  startTimestamp: number // indexed
  endTimestamp: number
  stkLyraDays: number
  inflationaryRewards: {
    lyra: number
    op: number
    isIgnored: boolean
  }
  lpDays: Record<string, number> // base
  boostedLpDays: Record<string, number> // boosted
  MMVRewards: Record<
    string,
    {
      isIgnored: boolean
      lyra: number
      op: number
    }
  >
  tradingRewards: {
    effectiveRebateRate: number
    lyraRebate: number
    opRebate: number
    tradingFees: number
  }
}

export default async function fetchAccountRewardEpochData(
  lyra: Lyra,
  account: string,
  blockTimestamp: number
): Promise<AccountRewardEpochData[]> {
  const key = account.toLowerCase()
  if (!ACCOUNT_EPOCH_CACHE[key] || blockTimestamp > ACCOUNT_EPOCH_CACHE[key].lastUpdated + ACCOUNT_EPOCH_CACHE_LIFE) {
    ACCOUNT_EPOCH_CACHE[key] = {
      epoch: fetchURL<AccountRewardEpochData[]>(
        `${lyra.apiUri}${ACCOUNT_URL}?account=${key}&deployment=${
          lyra.deployment === Deployment.Kovan ? 'kovan-ovm-avalon' : 'mainnet-ovm-avalon'
        }`
      ),
      lastUpdated: blockTimestamp,
    }
  }
  return ACCOUNT_EPOCH_CACHE[key].epoch
}
