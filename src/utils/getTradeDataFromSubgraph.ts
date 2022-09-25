import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'

import { UNIT, ZERO_BN } from '../constants/bn'
import { DataSource } from '../constants/contracts'
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
  const collateralAmount = !trade.position.isLong
    ? trade.setCollateralTo
      ? BigNumber.from(trade.setCollateralTo)
      : ZERO_BN
    : undefined
  const isBaseCollateral = !trade.position.isLong ? trade.position.isBaseCollateral : undefined
  const collateralValue = collateralAmount
    ? isBaseCollateral
      ? collateralAmount.mul(spotPrice).div(UNIT)
      : collateralAmount
    : undefined
  return {
    timestamp: trade.timestamp,
    source: DataSource.Subgraph,
    positionId: trade.position.positionId,
    blockNumber: trade.blockNumber,
    marketName: trade.market.name.substring(1),
    marketAddress: getAddress(trade.market.id),
    isCall: trade.option.isCall,
    strikeId: parseInt(trade.strike.strikeId),
    strikePrice,
    expiryTimestamp: trade.board.expiryTimestamp,
    transactionHash: trade.transactionHash,
    trader: getAddress(trade.trader),
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
    collateralAmount,
    collateralValue,
    isBaseCollateral,
    isForceClose: trade.isForceClose,
    isLiquidation: trade.isLiquidation,
    swap: trade.externalSwapFees
      ? {
          fee: BigNumber.from(trade.externalSwapFees),
          address: trade.externalSwapAddress,
        }
      : undefined,
  }
}
