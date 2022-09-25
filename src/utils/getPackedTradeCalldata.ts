import { BigNumber } from 'ethers'

import Lyra, { Position, TradeOptions } from '..'
import { AccountStableBalance } from '..'
import { ZERO_BN } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import { Option } from '../option'
import { TradeCollateral } from '../trade'
import getLyraContract from './getLyraContract'
import getOptionType from './getOptionType'
import {
  bnToUint32,
  bnToUint64,
  packAddLongParams,
  packAddShortParams,
  packCloseLongParams,
  packCloseShortParams,
  packOpenLongParams,
  packOpenShortParams,
  packReduceLongParams,
  packReduceShortParams,
} from './packTrades'

type TradeParams = {
  option: Option
  isOpen: boolean
  isLong: boolean
  size: BigNumber
  newSize: BigNumber
  inputAmount: BigNumber
  maxCost: BigNumber
  minCost: BigNumber
  iterations: number
  isForceClose: boolean
  stables: AccountStableBalance[]
  collateral?: TradeCollateral
  position?: Position
}

export default function getPackedTradeCalldata(
  lyra: Lyra,
  {
    option,
    isOpen,
    isLong,
    size,
    newSize,
    inputAmount,
    maxCost,
    minCost,
    iterations,
    isForceClose,
    stables,
    collateral,
    position,
  }: TradeParams,
  options: TradeOptions
): string {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const strike = option.strike()

  if (stables.length < 1) {
    return ''
  }
  const stable = stables.find(stable => stable.address === options.inputAsset?.address) ?? stables[0]
  const commonTradeParams = {
    market: option.market().__wrapperMarketId,
    token: stable.id,
    iterations,
    inputAmount: bnToUint32(inputAmount, stable.decimals),
  }
  if (isOpen) {
    // Open / Add
    if (isLong) {
      // Open / Add long
      if (position) {
        // Add long
        return wrapper.interface.encodeFunctionData('addLong', [
          packAddLongParams({
            ...commonTradeParams,
            positionId: position.id,
            maxCost: bnToUint32(maxCost),
            size: bnToUint64(size),
          }),
        ])
      } else {
        // Open long
        return wrapper.interface.encodeFunctionData('openLong', [
          packOpenLongParams({
            ...commonTradeParams,
            isCall: option.isCall,
            strikeId: strike.id,
            maxCost: bnToUint32(maxCost),
            size: bnToUint64(size),
          }),
        ])
      }
    } else {
      // Open / Add short
      if (position) {
        // Add short
        return wrapper.interface.encodeFunctionData('addShort', [
          packAddShortParams({
            ...commonTradeParams,
            positionId: position.id,
            minReceived: bnToUint32(minCost),
            size: bnToUint64(size),
            absoluteCollateral: collateral ? bnToUint64(collateral.amount) : ZERO_BN,
          }),
        ])
      } else {
        // Open Short
        return wrapper.interface.encodeFunctionData('openShort', [
          packOpenShortParams({
            ...commonTradeParams,
            optionType: getOptionType(option.isCall, isLong, collateral?.isBase ?? false),
            strikeId: strike.id,
            minReceived: bnToUint32(minCost),
            size: bnToUint64(size),
            collateral: collateral ? bnToUint64(collateral?.amount) : ZERO_BN,
          }),
        ])
      }
    }
  } else if (position) {
    //  Close / Reduce
    if (isLong) {
      //  Close / Reduce long
      if (newSize.gt(0)) {
        // Reduce long
        return wrapper.interface.encodeFunctionData('reduceLong', [
          packReduceLongParams({
            ...commonTradeParams,
            isForceClose: isForceClose,
            positionId: position.id,
            size: bnToUint64(size),
            minReceived: bnToUint32(minCost),
          }),
        ])
      } else {
        // Close long
        return wrapper.interface.encodeFunctionData('closeLong', [
          packCloseLongParams({
            ...commonTradeParams,
            isForceClose: isForceClose,
            positionId: position.id,
            minReceived: bnToUint32(minCost),
          }),
        ])
      }
    } else {
      //  Close / Reduce short
      if (newSize.gt(0)) {
        // Reduce short
        return wrapper.interface.encodeFunctionData('reduceShort', [
          packReduceShortParams({
            ...commonTradeParams,
            isForceClose: isForceClose,
            positionId: position.id,
            maxCost: bnToUint32(maxCost),
            size: bnToUint64(size),
            absoluteCollateral: collateral ? bnToUint64(collateral.amount) : ZERO_BN,
          }),
        ])
      } else {
        return wrapper.interface.encodeFunctionData('closeShort', [
          packCloseShortParams({
            ...commonTradeParams,
            isForceClose: isForceClose,
            positionId: position.id,
            maxCost: bnToUint32(maxCost),
          }),
        ])
      }
    }
  } else {
    // Should not be reached
    return ''
  }
}
