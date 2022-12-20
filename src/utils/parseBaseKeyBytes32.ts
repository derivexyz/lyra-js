import { formatBytes32String } from '@ethersproject/strings'

export default function parseBaseKeyBytes32(baseKey: string) {
  if (baseKey.startsWith('0x')) {
    // Assume variable is base key in bytes32
    return baseKey
  } else {
    // Account for "sETH", "ETH" or "eth" formats
    // Check that key starts with "s" and rest of string is uppercase
    const parsedBasekey =
      baseKey.startsWith('s') && baseKey.substring(1).toUpperCase() === baseKey.substring(1)
        ? baseKey
        : baseKey.startsWith('s')
        ? 's' + baseKey.substring(1).toUpperCase()
        : 's' + baseKey.toUpperCase()
    return formatBytes32String(parsedBasekey)
  }
}
