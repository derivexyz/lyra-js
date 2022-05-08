import { BigNumber } from '@ethersproject/bignumber'

import fromBigNumber from './fromBigNumber'

function replacer(_name: string, val: any) {
  if (typeof val === 'object' && val != null) {
    if (!Array.isArray(val)) {
      // Handle objects
      const newVal = Object.assign({}, val)
      Object.entries(val).forEach(([key, val]) => {
        if (BigNumber.isBigNumber(val)) {
          newVal[key] = fromBigNumber(val)
        } else {
          newVal[key] = val
        }
      })
      return newVal
    } else {
      // Handle arrays
      return val.map(val => {
        if (BigNumber.isBigNumber(val)) {
          return fromBigNumber(val)
        } else {
          return val
        }
      })
    }
  } else {
    return val
  }
}

// Handles BigNumber printing (assumes 18dp)
export default function printObject(...args: any[]): void {
  const parsedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg != null) {
      return JSON.stringify(arg, replacer, 2).replace(/"/g, '')
    } else {
      return arg
    }
  })
  console.log(...parsedArgs)
}
