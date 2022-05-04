import getScriptLyra from './utils/getScriptLyra'

export default async function markets(argv: string[]) {
  const { lyra } = getScriptLyra(argv)
  const markets = await lyra.markets()
  console.log(
    markets.map(market => ({
      address: market.address,
      name: market.name,
      expiries: market.liveBoards().map(board => ({
        id: board.id,
        expiryTimestamp: board.expiryTimestamp,
        strikes: board.strikes.length,
      })),
    }))
  )
}
