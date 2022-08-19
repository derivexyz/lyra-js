import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import { STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT, StrikeIVAndGreeksSnapshotQueryResult } from '../constants/queries'
import { StrikeIVHistory } from '../strike'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const strikeIVAndGreeksSnapshotsQuery = gql`
  query strikeIVAndGreeksSnapshots($strikeId: String!, $startTimestamp: Int!, $endTimestamp: Int!, $period: Int!) {
    strikeIVAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { strike: $strikeId, timestamp_gte: $startTimestamp, timestamp_lte: $endTimestamp, period_gte: $period }
    ) {
      ${STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchStrikeIVHistory(
  lyra: Lyra,
  strikeId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<StrikeIVHistory[]> {
  const data = await fetchSnapshots<
    StrikeIVAndGreeksSnapshotQueryResult,
    {
      strikeId: string
    }
  >(lyra, strikeIVAndGreeksSnapshotsQuery, 'strikeIVAndGreeksSnapshots', {
    strikeId: strikeId,
    startTimestamp,
    endTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp),
  })
  return data.map(snapshot => {
    return {
      iv: BigNumber.from(snapshot.iv),
      timestamp: snapshot.timestamp,
    }
  })
}
