import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import { STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT, StrikeIVAndGreeksSnapshotQueryResult } from '../constants/queries'
import { StrikeIVHistory } from '../strike'
import getSnapshotPeriod from './getSnapshotPeriod'

const strikeIVAndGreeksSnapshotsQuery = gql`
  query strikeIVAndGreeksSnapshots($strikeId: String!, $startTimestamp: Int!, $period: Int!) {
    strikeIVAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { strike: $strikeId, timestamp_gte: $startTimestamp, period_gte: $period }
    ) {
      ${STRIKE_IV_AND_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

type StrikeIVAndGreeksSnapshotVariables = {
  strikeId: string
  startTimestamp: number
  period: number
}

export default async function fetchStrikeIVAndGreeksDataByID(
  lyra: Lyra,
  strikeId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<StrikeIVHistory[]> {
  const res = await lyra.subgraphClient.request<
    { strikeIVAndGreeksSnapshots: StrikeIVAndGreeksSnapshotQueryResult[] },
    StrikeIVAndGreeksSnapshotVariables
  >(strikeIVAndGreeksSnapshotsQuery, {
    strikeId: strikeId,
    startTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp),
  })
  const strikeIVHistory: StrikeIVHistory[] = res.strikeIVAndGreeksSnapshots.map(
    (snapshot: StrikeIVAndGreeksSnapshotQueryResult) => {
      return {
        iv: BigNumber.from(snapshot.iv),
        timestamp: snapshot.timestamp,
      }
    }
  )
  return strikeIVHistory
}
