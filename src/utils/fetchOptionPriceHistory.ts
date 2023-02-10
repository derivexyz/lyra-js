import { gql } from '@apollo/client/core'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import {
  OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT,
  OptionPriceAndGreeksSnapshotQueryResult,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { Option, OptionPriceSnapshot } from '../option'
import fetchSnapshots from './fetchSnapshots'

const optionPriceAndGreeksSnapshotsQuery = gql`
  query optionPriceAndGreeksSnapshots($optionId: String!, $min: Int!, $max: Int!, $period: Int!) {
    optionPriceAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option: $optionId, timestamp_gte: $min, timestamp_lte: $max, period_gte: $period }
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
): Promise<OptionPriceSnapshot[]> {
  const board = option.board()
  const blockTimestamp = option.block.timestamp
  const endTimestamp = Math.min(board.expiryTimestamp, options?.endTimestamp ?? blockTimestamp)

  const data = await fetchSnapshots<OptionPriceAndGreeksSnapshotQueryResult, OptionPriceAndGreeksSnapshotVariables>(
    lyra,
    optionPriceAndGreeksSnapshotsQuery,
    {
      optionId: `${option.market().address.toLowerCase()}-${option.strike().id}-${option.isCall ? 'call' : 'put'}`,
    },
    {
      ...options,
      endTimestamp,
    }
  )
  const subgraphSnapshots: OptionPriceSnapshot[] = data.map((snapshot: OptionPriceAndGreeksSnapshotQueryResult) => ({
    optionPrice: BigNumber.from(snapshot.optionPrice),
    blockNumber: snapshot.blockNumber,
    timestamp: snapshot.timestamp,
  }))

  const currSnapshot: OptionPriceSnapshot = {
    optionPrice: option.price,
    blockNumber: option.block.number,
    timestamp: endTimestamp,
  }

  return [...subgraphSnapshots, currSnapshot].filter(s => s.optionPrice.gt(0))
}
