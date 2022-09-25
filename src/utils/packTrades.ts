import { BigNumber, BigNumberish } from '@ethersproject/bignumber'

import { UNIT } from '../constants/bn'
import { OptionType } from '../constants/contracts'

const TWO_BN = BigNumber.from(2)

export type WrapperTradeType =
  | 'openLong'
  | 'addLong'
  | 'reduceLong'
  | 'closeLong'
  | 'openShort'
  | 'addShort'
  | 'reduceShort'
  | 'closeShort'

enum DataTypes {
  uint8,
  uint32,
  uint64,
  bool,
}

type PackedTradeParameter = {
  offset: number
  type: DataTypes
}

export type PackedTradeParameters = {
  [key: string]: PackedTradeParameter
}

const PACKED_PARAMS: { [tradeType in WrapperTradeType]: PackedTradeParameters } = {
  openLong: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    isCall: { offset: 16, type: DataTypes.bool },
    iterations: { offset: 24, type: DataTypes.uint8 },
    strikeId: { offset: 32, type: DataTypes.uint32 },
    maxCost: { offset: 64, type: DataTypes.uint32 },
    inputAmount: { offset: 96, type: DataTypes.uint32 },
    size: { offset: 128, type: DataTypes.uint64 },
  },
  addLong: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    positionId: { offset: 24, type: DataTypes.uint32 },
    maxCost: { offset: 56, type: DataTypes.uint32 },
    inputAmount: { offset: 88, type: DataTypes.uint32 },
    size: { offset: 120, type: DataTypes.uint64 },
  },
  reduceLong: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    isForceClose: { offset: 24, type: DataTypes.bool },
    positionId: { offset: 32, type: DataTypes.uint32 },
    inputAmount: { offset: 64, type: DataTypes.uint32 },
    size: { offset: 96, type: DataTypes.uint64 },
    minReceived: { offset: 160, type: DataTypes.uint32 },
  },
  closeLong: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    isForceClose: { offset: 24, type: DataTypes.bool },
    positionId: { offset: 32, type: DataTypes.uint32 },
    inputAmount: { offset: 64, type: DataTypes.uint32 },
    minReceived: { offset: 96, type: DataTypes.uint32 },
  },
  openShort: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    optionType: { offset: 16, type: DataTypes.uint8 },
    iterations: { offset: 24, type: DataTypes.uint8 },
    strikeId: { offset: 32, type: DataTypes.uint32 },
    minReceived: { offset: 64, type: DataTypes.uint32 },
    inputAmount: { offset: 96, type: DataTypes.uint32 },
    size: { offset: 128, type: DataTypes.uint64 },
    collateral: { offset: 192, type: DataTypes.uint64 },
  },
  addShort: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    positionId: { offset: 24, type: DataTypes.uint32 },
    inputAmount: { offset: 56, type: DataTypes.uint32 },
    minReceived: { offset: 88, type: DataTypes.uint32 },
    size: { offset: 120, type: DataTypes.uint64 },
    absoluteCollateral: { offset: 184, type: DataTypes.uint64 },
  },
  reduceShort: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    isForceClose: { offset: 24, type: DataTypes.bool },
    positionId: { offset: 32, type: DataTypes.uint32 },
    inputAmount: { offset: 64, type: DataTypes.uint32 },
    maxCost: { offset: 96, type: DataTypes.uint32 },
    size: { offset: 128, type: DataTypes.uint64 },
    absoluteCollateral: { offset: 196, type: DataTypes.uint64 },
  },
  closeShort: {
    market: { offset: 0, type: DataTypes.uint8 },
    token: { offset: 8, type: DataTypes.uint8 },
    iterations: { offset: 16, type: DataTypes.uint8 },
    isForceClose: { offset: 24, type: DataTypes.bool },
    positionId: { offset: 32, type: DataTypes.uint32 },
    inputAmount: { offset: 64, type: DataTypes.uint32 },
    maxCost: { offset: 96, type: DataTypes.uint32 },
  },
}

export function toUint64(amount: number): BigNumber {
  // This is converting to 1dp of precision
  return BigNumber.from(amount).mul(100_000_000)
}

export function toUint32(amount: number): BigNumber {
  // This is converting to 1dp of precision
  const bn = BigNumber.from(amount).mul(100)
  return BigNumber.from(Math.ceil(bn.toNumber() / 10) * 10)
}

export function bnToUint32(amount: BigNumberish, decimals: number = 18): BigNumber {
  return BigNumber.from(amount).mul(100).div(BigNumber.from(10).pow(decimals))
}

export function bnToUint64(amount: BigNumberish): BigNumber {
  return BigNumber.from(amount).mul(100_000_000).div(UNIT)
}

function paramAddValue(val: BigNumberish | boolean, paramMeta: { offset: number; type: DataTypes }) {
  if (val === true || val === false) {
    if (paramMeta.type == DataTypes.bool) {
      return BigNumber.from(val ? 1 : 0).mul(TWO_BN.pow(paramMeta.offset))
    }
    throw Error('boolean value has non bool datatype')
  }

  const bnVal = BigNumber.from(val)

  if (paramMeta.type == DataTypes.uint8 && bnVal.gte(TWO_BN.pow(8))) throw Error('value too large for datatype uint8')
  if (paramMeta.type == DataTypes.uint32 && bnVal.gte(TWO_BN.pow(32)))
    throw Error('value too large for datatype uint32')
  if (paramMeta.type == DataTypes.uint64 && bnVal.gte(TWO_BN.pow(64)))
    throw Error('value too large for datatype uint64')
  return bnVal.mul(TWO_BN.pow(paramMeta.offset))
}

function getPackedParams(params: { [key: string]: BigNumberish | boolean }, paramsForType: PackedTradeParameters) {
  let packedParams = BigNumber.from(0)
  for (const key of Object.keys(params)) {
    if (!paramsForType[key]) throw Error(`key ${key} missing from paramsForType ${JSON.stringify(paramsForType)}`)
    packedParams = packedParams.add(paramAddValue(params[key], paramsForType[key]))
  }
  return packedParams
}

export function packOpenLongParams(params: {
  market: BigNumberish // 8
  token: BigNumberish // 16
  isCall: boolean // 24
  iterations: BigNumberish // 32
  strikeId: BigNumberish // 64
  maxCost: BigNumberish // 96
  inputAmount: BigNumberish // 128
  size: BigNumberish // 192
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.openLong)
}

export function packAddLongParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  positionId: BigNumberish
  maxCost: BigNumberish
  inputAmount: BigNumberish
  size: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.addLong)
}

export function packReduceLongParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  isForceClose: boolean
  positionId: BigNumberish
  inputAmount: BigNumberish
  size: BigNumberish
  minReceived: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.reduceLong)
}

export function packCloseLongParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  isForceClose: boolean
  positionId: BigNumberish
  inputAmount: BigNumberish
  minReceived: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.closeLong)
}

export function packOpenShortParams(params: {
  market: BigNumberish
  token: BigNumberish
  optionType: OptionType
  iterations: BigNumberish
  strikeId: BigNumberish
  minReceived: BigNumberish
  inputAmount: BigNumberish
  size: BigNumberish
  collateral: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.openShort)
}

export function packAddShortParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  positionId: BigNumberish
  inputAmount: BigNumberish
  minReceived: BigNumberish
  size: BigNumberish
  absoluteCollateral: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.addShort)
}

export function packReduceShortParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  isForceClose: boolean
  positionId: BigNumberish
  inputAmount: BigNumberish
  maxCost: BigNumberish
  size: BigNumberish
  absoluteCollateral: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.reduceShort)
}

export function packCloseShortParams(params: {
  market: BigNumberish
  token: BigNumberish
  iterations: BigNumberish
  isForceClose: boolean
  positionId: BigNumberish
  inputAmount: BigNumberish
  maxCost: BigNumberish
}): BigNumber {
  return getPackedParams(params, PACKED_PARAMS.closeShort)
}
