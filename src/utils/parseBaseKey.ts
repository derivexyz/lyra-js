import { ethers } from 'ethers'

export default function parseBaseKey(baseKey: string) {
  if (baseKey.startsWith('0x')) {
    // Assume variable is base key in bytes32
    return baseKey
  } else {
    // Account for "sETH", "ETH" or "eth" formats
    // Check that key starts with "s" and rest of string is uppercase
    const parsedBasekey =
      baseKey.startsWith('s') && baseKey.substring(1).toUpperCase() === baseKey.substring(1)
        ? baseKey
        : 's' + baseKey.toUpperCase()
    return ethers.utils.formatBytes32String(parsedBasekey)
  }
}
