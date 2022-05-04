import { BigNumber } from 'ethers'

import { UNIT, ZERO_BN } from '../constants/bn'
import { TradeQueryResult } from '../constants/queries'
import { TradeEventData } from '../trade_event'

export default function getTradeDataFromSubgraph(trade: TradeQueryResult): TradeEventData {
  const size = BigNumber.from(trade.size)
  const spotPrice = BigNumber.from(trade.spotPrice)
  const premium = BigNumber.from(trade.premium)
  const spotPriceFee = BigNumber.from(trade.spotPriceFee)
  const optionPriceFee = BigNumber.from(trade.optionPriceFee)
  const vegaUtilFee = BigNumber.from(trade.vegaUtilFee)
  const varianceFee = BigNumber.from(trade.varianceFee)
  const swapFee = BigNumber.from(trade.externalSwapFees ?? 0)
  const strikePrice = BigNumber.from(trade.strike.strikePrice)
  const setCollateralTo = !trade.position.isLong
    ? trade.setCollateralTo
      ? BigNumber.from(trade.setCollateralTo)
      : ZERO_BN
    : undefined
  const isBaseCollateral = !trade.position.isLong ? trade.position.isBaseCollateral : undefined
  return {
    timestamp: trade.timestamp,
    positionId: trade.position.positionId,
    blockNumber: trade.blockNumber,
    marketName: trade.market.name.substring(1),
    marketAddress: trade.market.id,
    isCall: trade.option.isCall,
    strikeId: parseInt(trade.strike.strikeId),
    strikePrice,
    expiryTimestamp: trade.board.expiryTimestamp,
    transactionHash: trade.transactionHash,
    trader: trade.trader,
    size,
    isOpen: trade.isOpen,
    isBuy: trade.isBuy,
    isLong: trade.position.isLong,
    spotPrice,
    pricePerOption: premium.mul(UNIT).div(size),
    premium,
    fee: spotPriceFee.add(optionPriceFee).add(vegaUtilFee).add(varianceFee).add(swapFee),
    feeComponents: {
      spotPriceFee,
      optionPriceFee,
      vegaUtilFee,
      varianceFee,
    },
    iv: BigNumber.from(trade.newIv),
    baseIv: BigNumber.from(trade.newBaseIv),
    skew: BigNumber.from(trade.newSkew),
    volTraded: BigNumber.from(trade.volTraded),
    setCollateralTo,
    isBaseCollateral,
    isForceClose: trade.isForceClose,
    isLiquidation: trade.isLiquidation,
  }
}
