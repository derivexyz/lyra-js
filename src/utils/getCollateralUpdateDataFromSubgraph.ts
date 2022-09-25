import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'

import { CollateralUpdateData } from '../collateral_update_event'
import { UNIT } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { CollateralUpdateQueryResult } from '../constants/queries'

export default function getCollateralUpdateDataFromSubgraph(update: CollateralUpdateQueryResult): CollateralUpdateData {
  const amount = BigNumber.from(update.amount)
  const spotPrice = BigNumber.from(update.spotPrice)
  const isBaseCollateral = update.isBaseCollateral
  const value = isBaseCollateral ? amount.mul(spotPrice).div(UNIT) : amount
  const strikePrice = BigNumber.from(update.strike.strikePrice)
  // TODO: @dappbeast Fix strikeId type in subgraph
  const strikeId = parseInt(update.strike.strikeId)
  // Remove "s" prefix from name
  const marketName = update.market.name.substring(1)
  return {
    owner: getAddress(update.trader),
    source: DataSource.Subgraph,
    timestamp: update.timestamp,
    amount,
    value,
    positionId: update.position.positionId,
    blockNumber: update.blockNumber,
    isBaseCollateral,
    marketName,
    marketAddress: getAddress(update.market.id),
    isCall: update.option.isCall,
    strikeId,
    strikePrice,
    spotPrice,
    expiryTimestamp: update.board.expiryTimestamp,
    transactionHash: update.transactionHash,
    swap: update.externalSwapFees
      ? {
          address: update.externalSwapAddress,
        }
      : undefined,
  }
}
