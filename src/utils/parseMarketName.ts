export default function parseMarketName(marketName: string) {
  const [baseKey, quoteKey] = marketName.split('-')
  if (!baseKey) {
    throw new Error(`Invalid market name arg: ${marketName}`)
  }
  return { baseKey, quoteKey }
}
