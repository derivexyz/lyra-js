import { BigNumber } from 'ethers'

import { CollateralUpdateData } from '../collateral_update_event'
import { CollateralUpdateQueryResult } from '../constants/queries'

export default function getCollateralUpdateDataFromSubgraph(update: CollateralUpdateQueryResult): CollateralUpdateData {
  const setCollateralTo = BigNumber.from(update.amount)
  const strikePrice = BigNumber.from(update.strike.strikePrice)
  return {
    owner: update.trader,
    timestamp: update.timestamp,
    setCollateralTo,
    positionId: update.position.positionId,
    blockNumber: update.blockNumber,
    isBaseCollateral: update.isBaseCollateral,
    marketName: update.market.name.substring(1),
    marketAddress: update.market.id,
    isCall: update.option.isCall,
    strikeId: parseInt(update.strike.strikeId),
    strikePrice,
    expiryTimestamp: update.board.expiryTimestamp,
    transactionHash: update.transactionHash,
  }
}
