import { UNIT, ZERO_BN } from '../constants/bn'
import { TradeDirection } from '../constants/contracts'
import { PartialTradeEvent } from '../constants/events'
import { Market } from '../market'
import { TradeEventData } from '../trade_event'
import { TransferEventData } from '../transfer_event'
import getIsBaseCollateral from './getIsBaseCollateral'
import getIsBuy from './getIsBuy'
import getIsCall from './getIsCall'
import getIsLong from './getIsLong'
import getOwner from './getOwner'

export default function getTradeDataFromEvent(
  market: Market,
  trade: PartialTradeEvent,
  transfers: TransferEventData[]
): TradeEventData {
  const marketName = market.name
  const marketAddress = market.address
  const expiryTimestamp = trade.args.trade.expiry.toNumber()
  const strikePrice = trade.args.trade.strikePrice
  const positionId = trade.args.positionId.toNumber()
  const strikeId = trade.args.strikeId.toNumber()
  const isCall = getIsCall(trade.args.trade.optionType)
  const isLong = getIsLong(trade.args.trade.optionType)
  const isForceClose = trade.args.trade.isForceClose
  const isOpen = trade.args.trade.tradeDirection === TradeDirection.Open
  const isBuy = getIsBuy(trade.args.trade.optionType, isOpen)
  const size = trade.args.trade.amount
  const spotPrice = trade.args.trade.spotPrice
  const isLiquidation = trade.args.trade.tradeDirection === TradeDirection.Liquidate
  const liquidation = trade.args.liquidation
  const blockNumber = trade.blockNumber
  const transactionHash = trade.transactionHash

  const tradeResults = trade.args.tradeResults
  const optionPriceFee = tradeResults.reduce((sum, res) => sum.add(res.optionPriceFee), ZERO_BN)
  const spotPriceFee = tradeResults.reduce((sum, res) => sum.add(res.spotPriceFee), ZERO_BN)
  const vegaUtilFee = tradeResults.reduce((sum, res) => sum.add(res.vegaUtilFee.vegaUtilFee), ZERO_BN)
  const varianceFee = tradeResults.reduce((sum, res) => sum.add(res.varianceFee.varianceFee), ZERO_BN)
  const fee = optionPriceFee.add(spotPriceFee).add(vegaUtilFee).add(varianceFee)
  const premium = tradeResults.reduce((sum, res) => sum.add(res.totalCost), ZERO_BN)
  const lastTradeResult = tradeResults[tradeResults.length - 1]
  const newBaseIv = lastTradeResult.newBaseIv
  const newSkew = lastTradeResult.newSkew
  const newIv = newBaseIv.mul(newSkew).div(UNIT)
  const volTraded = lastTradeResult.volTraded
  const pricePerOption = size.gt(0) ? premium.mul(UNIT).div(size) : ZERO_BN

  const setCollateralTo = !isLong ? trade.args.trade.setCollateralTo : undefined
  const isBaseCollateral = !isLong ? getIsBaseCollateral(trade.args.trade.optionType) : undefined

  const timestamp = trade.args.timestamp.toNumber()

  const trader = getOwner(transfers, blockNumber)

  return {
    timestamp,
    positionId,
    strikeId,
    strikePrice,
    marketName,
    marketAddress,
    expiryTimestamp,
    blockNumber,
    transactionHash,
    trader,
    size,
    premium,
    fee,
    feeComponents: {
      optionPriceFee,
      spotPriceFee,
      vegaUtilFee,
      varianceFee,
    },
    pricePerOption,
    isOpen,
    isCall,
    isBuy,
    isLong,
    spotPrice,
    setCollateralTo,
    isBaseCollateral,
    isForceClose,
    isLiquidation,
    liquidation,
    iv: newIv,
    skew: newSkew,
    baseIv: newBaseIv,
    volTraded,
    // TODO(@michaelxuwu): fix this
    externalSwapFee: ZERO_BN,
  }
}
