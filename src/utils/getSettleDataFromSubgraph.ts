import { BigNumber } from 'ethers'

import { SettleQueryResult } from '../constants/queries'
import { SettleEventData } from '../settle_event'

export default function getSettleDataFromSubgraph(update: SettleQueryResult): SettleEventData {
  const size = BigNumber.from(update.size)
  const spotPriceAtExpiry = BigNumber.from(update.spotPriceAtExpiry)
  const strikePrice = BigNumber.from(update.position.strike.strikePrice)
  const pnl = BigNumber.from(update.profit)
  return {
    blockNumber: update.blockNumber,
    positionId: parseInt(update.position.id),
    pnl,
    size,
    spotPriceAtExpiry,
    timestamp: update.timestamp,
    transactionHash: update.transactionHash,
    owner: update.owner,
    marketName: update.position.market.name.substring(1),
    marketAddress: update.position.market.id,
    expiryTimestamp: update.position.board.expiryTimestamp,
    isCall: update.position.option.isCall,
    strikePrice,
    position: update.position,
  }
}
