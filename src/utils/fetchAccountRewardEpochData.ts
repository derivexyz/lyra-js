import { ethers } from 'ethers'
import { equalTo, get, orderByChild, query, ref } from 'firebase/database'

import { FirebaseCollections } from '../constants/collections'
import Lyra, { Deployment } from '../lyra'
import connectToFirebaseDatabase from './connectToFirebaseDatabase'

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
    totalCollatRebateDollars: number
  }
}

export default async function fetchAccountRewardEpochData(
  lyra: Lyra,
  account: string,
  blockTimestamp: number
): Promise<AccountRewardEpochData[]> {
  if (lyra.deployment !== Deployment.Mainnet) {
    throw new Error('GlobalRewardEpoch only supported on mainnet')
  }
  const key = ethers.utils.getAddress(account as string)
  if (!ACCOUNT_EPOCH_CACHE[key] || blockTimestamp > ACCOUNT_EPOCH_CACHE[key].lastUpdated + ACCOUNT_EPOCH_CACHE_LIFE) {
    const database = connectToFirebaseDatabase()
    const collectionReference = ref(database, FirebaseCollections.AvalonAccountRewardsEpoch)
    const queryReference = query(collectionReference, orderByChild('account'), equalTo(key))
    const epochPromise = async (): Promise<AccountRewardEpochData[]> => {
      const snapshot = await get(queryReference)
      return snapshot.val() ? Object.values(snapshot.val()) : []
    }
    ACCOUNT_EPOCH_CACHE[key] = {
      epoch: epochPromise(),
      lastUpdated: blockTimestamp,
    }
  }
  return await ACCOUNT_EPOCH_CACHE[key].epoch
}
