import getLyra from './utils/getLyra'

export default async function leaderboard() {
  const lyra = getLyra()
  const leaderboard = await lyra.leaderboard({
    minPositionIds: {
      eth: 4490,
      btc: 178,
    },
  })
  console.log('pid', leaderboard.length)
}
