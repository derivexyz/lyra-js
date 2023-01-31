import { gql } from '@apollo/client'
import { BigNumber } from '@ethersproject/bignumber'

import Lyra from '..'
import {
  OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT,
  OptionPriceAndGreeksSnapshotQueryResult,
} from '../constants/queries'
import { SnapshotOptions } from '../constants/snapshots'
import { OptionPriceSnapshot } from '../option'
import { Position } from '../position'
import fetchSnapshots from './fetchSnapshots'

const optionPriceAndGreeksSnapshotsQuery = gql`
  query optionPriceAndGreeksSnapshots($optionIds: [String!]!, $min: Int!, $max: Int!, $period: Int!) {
    optionPriceAndGreeksSnapshots(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { option_in: $optionIds, timestamp_gte: $min, timestamp_lte: $max, period_gte: $period }
    ) {
      ${OPTION_PRICE_AND_GREEKS_SNAPSHOT_FRAGMENT}
    }
  }
`

export default async function fetchPositionPriceHistoryByIDs(
  lyra: Lyra,
  positions: Position[],
  snapshotOptions?: SnapshotOptions
): Promise<Record<number, OptionPriceSnapshot[]>> {
  const optionIdByPositionId: Record<number, string> = positions.reduce(
    (dict, { id, marketAddress, strikeId, isCall }) => ({
      ...dict,
      [id]: `${marketAddress.toLowerCase()}-${strikeId}-${isCall ? 'call' : 'put'}`,
    }),
    {}
  )
  const optionIds = Array.from(new Set(Object.values(optionIdByPositionId)))
  const data = await fetchSnapshots<OptionPriceAndGreeksSnapshotQueryResult, { optionIds: string[] }>(
    lyra,
    optionPriceAndGreeksSnapshotsQuery,
    {
      optionIds,
    },
    snapshotOptions
  )
  const pricesByOptionId: Record<string, OptionPriceSnapshot[]> = data.reduce((dict, snapshot) => {
    const prices = dict[snapshot.option.id] ?? []
    prices.push({
      optionPrice: BigNumber.from(snapshot.optionPrice),
      timestamp: snapshot.blockTimestamp, // Use last updated timestamp
      blockNumber: snapshot.blockNumber,
    })
    return {
      ...dict,
      [snapshot.option.id]: prices,
    }
  }, {} as Record<string, OptionPriceSnapshot[]>)
  const pricesByPositionId: Record<number, OptionPriceSnapshot[]> = Object.entries(optionIdByPositionId).reduce(
    (dict, [positionId, optionId]) => ({
      ...dict,
      [positionId]: pricesByOptionId[optionId],
    }),
    {}
  )
  return pricesByPositionId
}
