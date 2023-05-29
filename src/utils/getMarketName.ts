export default function getMarketName(_baseSymbol: string, quoteSymbol: string) {
  let baseSymbol = _baseSymbol
  switch (baseSymbol.toLowerCase()) {
    case 'weth':
      baseSymbol = 'ETH'
      break
    case 'lyarb':
      baseSymbol = 'ARB'
      break
  }
  return `${baseSymbol}-${quoteSymbol}`
}
