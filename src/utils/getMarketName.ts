export default function getMarketName(_baseSymbol: string, quoteSymbol: string) {
  let baseSymbol = _baseSymbol
  if (baseSymbol.toLowerCase() === 'weth') {
    baseSymbol = 'ETH'
  }
  return `${baseSymbol}-${quoteSymbol}`
}
