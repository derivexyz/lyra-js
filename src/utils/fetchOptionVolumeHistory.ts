import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import {
  MAX_END_TIMESTAMP,
  OPTION_VOLUME_FRAGMENT,
  OptionVolumeQueryResult,
  SnapshotPeriod,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Option, OptionTradingVolume } from '../option'
import fetchSnapshots from './fetchSnapshots'

const optionVolumeQuery = gql`
  query optionVolumeQuery($optionId: String!, $min: Int!, $max: Int!, $period: Int!) {
    optionVolumeSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option: $optionId, timestamp_gte: $min, timestamp_lte: $max, period: $period }
    ) {
      ${OPTION_VOLUME_FRAGMENT}
    }
  }
`

export default async function fetchOptionVolumeHistory(
  lyra: Lyra,
  option: Option,
  options?: SnapshotOptions
): Promise<OptionTradingVolume[]> {
  const board = option.board()
  const endTimestamp = Math.min(board.expiryTimestamp, options?.endTimestamp ?? MAX_END_TIMESTAMP)
  const optionId = `${option.market().address.toLowerCase()}-${option.strike().id}-${option.isCall ? 'call' : 'put'}`
  const data = await fetchSnapshots<
    OptionVolumeQueryResult,
    {
      optionId: string
    }
  >(
    lyra,
    optionVolumeQuery,
    {
      optionId,
    },
    {
      ...options,
      period: SnapshotPeriod.OneHour,
      endTimestamp,
    }
  )
  return data.map(snapshot => ({
    notionalVolume: BigNumber.from(snapshot.notionalVolume),
    premiumVolume: BigNumber.from(snapshot.premiumVolume),
    timestamp: snapshot.timestamp,
  }))
}
