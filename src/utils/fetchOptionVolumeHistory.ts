import { BigNumber } from 'ethers'
import { gql } from 'graphql-request'

import Lyra from '..'
import { OPTION_VOLUME_FRAGMENT, OptionVolumeQueryResult, SnapshotPeriod } from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Option, OptionTradingVolume } from '../option'
import fetchSnapshots from './fetchSnapshots'

const optionVolumeQuery = gql`
  query optionVolumeQuery($optionId: String!, $startTimestamp: Int!, $endTimestamp: Int!, $period: Int!) {
    optionVolumeSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option: $optionId, timestamp_gte: $startTimestamp, timestamp_lte: $endTimestamp, period: $period }
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
  const startTimestamp = options?.startTimestamp ?? 0
  const endOrExpiryTimestamp = board.isExpired ? board.expiryTimestamp : board.block.timestamp
  const optionId = `${option.market().address.toLowerCase()}-${option.strike().id}-${option.isCall ? 'call' : 'put'}`
  const data = await fetchSnapshots<
    OptionVolumeQueryResult,
    {
      optionId: string
    }
  >(lyra, optionVolumeQuery, 'optionVolumeSnapshots', {
    optionId,
    startTimestamp,
    endTimestamp: endOrExpiryTimestamp,
    period: SnapshotPeriod.OneHour,
  })
  return data.map(snapshot => ({
    notionalVolume: BigNumber.from(snapshot.notionalVolume),
    premiumVolume: BigNumber.from(snapshot.premiumVolume),
    timestamp: snapshot.timestamp,
  }))
}
