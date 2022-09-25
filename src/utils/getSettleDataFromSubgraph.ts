import { getAddress } from '@ethersproject/address'
import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
import { SettleQueryResult } from '../constants/queries'
import { SettleEventData } from '../settle_event'

export default function getSettleDataFromSubgraph(settle: SettleQueryResult): SettleEventData {
  const spotPriceAtExpiry = BigNumber.from(settle.spotPriceAtExpiry)
  const strikePrice = BigNumber.from(settle.position.strike.strikePrice)
  const expiryTimestamp = settle.position.board.expiryTimestamp
  const size = BigNumber.from(settle.size)

  const isLong = settle.position.isLong
  const isBaseCollateral = settle.position.isBaseCollateral
  const settleAmount = BigNumber.from(settle.settleAmount)
  const settlement = isLong ? settleAmount : ZERO_BN
  const returnedCollateralAmount = !isLong ? settleAmount : ZERO_BN
  const returnedCollateralValue = isBaseCollateral
    ? returnedCollateralAmount.mul(spotPriceAtExpiry).div(UNIT)
    : returnedCollateralAmount

  const isCall = settle.position.option.isCall

  const isInTheMoney = isCall ? spotPriceAtExpiry.gt(strikePrice) : spotPriceAtExpiry.lt(strikePrice)

  return {
    source: DataSource.Subgraph,
    blockNumber: settle.blockNumber,
    positionId: settle.position.positionId,
    timestamp: settle.timestamp,
    size,
    spotPriceAtExpiry,
    transactionHash: settle.transactionHash,
    owner: getAddress(settle.owner),
    marketName: settle.position.market.name.substring(1),
    marketAddress: getAddress(settle.position.market.id),
    expiryTimestamp,
    isCall: settle.position.option.isCall,
    strikePrice,
    isBaseCollateral: settle.position.isBaseCollateral,
    isLong: settle.position.isLong,
    settlement,
    isInTheMoney,
    returnedCollateralAmount,
    returnedCollateralValue,
  }
}
