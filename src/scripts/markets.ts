import getScriptLyra from './utils/getScriptLyra'

export default async function markets(argv: string[]) {
  const { lyra } = getScriptLyra(argv)

  // Fetch all markets
  const markets = await lyra.markets()

  console.log(
    markets.map(market => ({
      address: market.address,
      name: market.name,
      // List all live boards (expiries)
      expiries: market.liveBoards().map(board => ({
        id: board.id,
        expiryTimestamp: board.expiryTimestamp,
        // List all strikes
        strikes: board.strikes().map(strike => ({
          id: strike.id,
          strikePrice: strike.strikePrice,
        })),
      })),
    }))
  )
}
