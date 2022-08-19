import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import {
  OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT,
  OptionPriceAndGreeksSnapshotQueryResult,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Option, OptionPriceHistory } from '../option'
import fetchSnapshots from './fetchSnapshots'
import getSnapshotPeriod from './getSnapshotPeriod'

const optionPriceAndGreeksSnapshotsQuery = gql`
  query optionPriceAndGreeksSnapshots($optionId: String!, $startTimestamp: Int!, $endTimestamp: Int!, $period: Int!) {
    optionPriceAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option: $optionId, optionPrice_gt: 0, timestamp_gte: $startTimestamp, timestamp_lte: $endTimestamp, period_gte: $period }
    ) {
      ${OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

type OptionPriceAndGreeksSnapshotVariables = {
  optionId: string
}

export default async function fetchOptionPriceHistory(
  lyra: Lyra,
  option: Option,
  options?: SnapshotOptions
): Promise<OptionPriceHistory[]> {
  const board = option.board()
  const startTimestamp = options?.startTimestamp ?? 0
  const endOrExpiryTimestamp = board.isExpired ? board.expiryTimestamp : board.block.timestamp
  const data = await fetchSnapshots<OptionPriceAndGreeksSnapshotQueryResult, OptionPriceAndGreeksSnapshotVariables>(
    lyra,
    optionPriceAndGreeksSnapshotsQuery,
    'optionPriceAndGreeksSnapshots',
    {
      optionId: `${option.market().address.toLowerCase()}-${option.strike().id}-${option.isCall ? 'call' : 'put'}`,
      startTimestamp,
      endTimestamp: endOrExpiryTimestamp,
      period: getSnapshotPeriod(startTimestamp, endOrExpiryTimestamp),
    }
  )
  return data.map((snapshot: OptionPriceAndGreeksSnapshotQueryResult) => {
    return {
      optionPrice: BigNumber.from(snapshot.optionPrice),
      timestamp: snapshot.timestamp,
    }
  })
}
