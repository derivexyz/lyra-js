import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import {
  OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT,
  OptionPriceAndGreeksSnapshotQueryResult,
} from '../constants/queries'
import { OptionPriceHistory } from '../option'
import getSnapshotPeriod from './getSnapshotPeriod'

const optionPriceAndGreeksSnapshotsQuery = gql`
  query optionPriceAndGreeksSnapshots($optionId: String!, $startTimestamp: Int!, $period: Int!) {
    optionPriceAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option: $optionId, timestamp_gte: $startTimestamp, period_gte: $period, optionPrice_gt: 0 }
    ) {
      ${OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

type OptionPriceAndGreeksSnapshotVariables = {
  optionId: string
  startTimestamp: number
  period: number
}

export default async function fetchOptionPriceAndGreeksDataByID(
  lyra: Lyra,
  optionId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<OptionPriceHistory[]> {
  const res = await lyra.subgraphClient.request<
    { optionPriceAndGreeksSnapshots: OptionPriceAndGreeksSnapshotQueryResult[] },
    OptionPriceAndGreeksSnapshotVariables
  >(optionPriceAndGreeksSnapshotsQuery, {
    optionId: optionId,
    startTimestamp,
    period: getSnapshotPeriod(startTimestamp, endTimestamp, true),
  })
  const optionPriceHistory: OptionPriceHistory[] = res.optionPriceAndGreeksSnapshots.map(
    (snapshot: OptionPriceAndGreeksSnapshotQueryResult) => {
      return {
        optionPrice: BigNumber.from(snapshot.optionPrice),
        timestamp: snapshot.timestamp,
      }
    }
  )
  return optionPriceHistory
}
