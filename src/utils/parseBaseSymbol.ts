import Lyra, { Version } from '../lyra'

export default function parseBaseSymbol(lyra: Lyra, marketAddressOrName: string): string {
  const [rawBaseKey] = marketAddressOrName.split('-')
  if (lyra.version === Version.Avalon) {
    // Hardcode sETH, sBTC, sSOL
    switch (rawBaseKey.toLowerCase()) {
      case 'eth':
      case 'seth':
        return 'sETH'
      case 'btc':
      case 'sbtc':
        return 'sBTC'
      case 'sol':
      case 'ssol':
        return 'sSOL'
      default:
        // Not reachable
        return rawBaseKey
    }
  } else {
    switch (rawBaseKey.toLowerCase()) {
      case 'eth':
      case 'weth':
        return 'WETH'
      case 'btc':
      case 'wbtc':
        return 'WBTC'
      case 'lyarb':
      case 'arb':
        return 'LyARB'
      default:
        // Add overrides for markets as individual cases
        return rawBaseKey.toUpperCase()
    }
  }
}
