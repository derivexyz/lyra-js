import Lyra from '..'
import { UNIT, ZERO_BN } from '../constants/bn'
import { Position, PositionLeaderboard, PositionLeaderboardFilter, PositionLeaderboardSortBy } from '../position'
import fromBigNumber from './fromBigNumber'

const sortBy = (a: PositionLeaderboard, b: PositionLeaderboard, sortBy: PositionLeaderboardSortBy): number => {
  switch (sortBy) {
    case PositionLeaderboardSortBy.RealizedPnl:
      return fromBigNumber(b.realizedPnl.sub(a.realizedPnl))
    case PositionLeaderboardSortBy.RealizedLongPnl:
      return fromBigNumber(b.realizedLongPnl.sub(a.realizedLongPnl))
    case PositionLeaderboardSortBy.RealizedLongPnlPercentage:
      return fromBigNumber(b.realizedLongPnlPercentage.sub(a.realizedLongPnlPercentage))
    case PositionLeaderboardSortBy.UnrealizedPnl:
      return fromBigNumber(b.unrealizedPnl.sub(a.unrealizedPnl))
    case PositionLeaderboardSortBy.UnrealizedLongPnl:
      return fromBigNumber(b.unrealizedLongPnl.sub(a.unrealizedLongPnl))
    case PositionLeaderboardSortBy.UnrealizedLongPnlPercentage:
      return fromBigNumber(b.unrealizedLongPnlPercentage.sub(a.unrealizedLongPnlPercentage))
  }
}

export default async function fetchLeaderboard(
  lyra: Lyra,
  options?: PositionLeaderboardFilter
): Promise<PositionLeaderboard[]> {
  const positions = await lyra.allPositions(options)
  const minTotalPremiums = options?.minTotalPremiums
  const minTotalLongPremiums = options?.minTotalLongPremiums

  const positionByWallet: Record<string, Position[]> = positions.reduce(
    (dict: Record<string, Position[]>, position) => {
      const positions: Position[] = dict[position.owner] ?? []
      return {
        ...dict,
        [position.owner]: [...positions, position],
      }
    },
    {}
  )
  const leaderboard = Object.entries(positionByWallet)
    .map(([account, positions]) => {
      let accountUnrealizedPnl = ZERO_BN
      let accountRealizedPnl = ZERO_BN
      let accountRealizedLongPnl = ZERO_BN
      let accountUnrealizedLongPnl = ZERO_BN
      let totalLongAverageCloseOrSettleCost = ZERO_BN
      let totalLongAverageOpenCost = ZERO_BN
      let totalNotionalVolume = ZERO_BN
      let totalPremiums = ZERO_BN
      let totalLongPremiums = ZERO_BN

      positions
        // Ignore transferred positions in P&L calcs
        .filter(p => p.transfers().length === 0)
        .forEach(position => {
          const { isLong, isSettled } = position
          const { realizedPnl, settlementPnl, unrealizedPnl, totalAverageCloseCost, totalAverageOpenCost } =
            position.pnl()
          accountRealizedPnl = accountRealizedPnl.add(realizedPnl).add(settlementPnl)
          accountUnrealizedPnl = accountUnrealizedPnl.add(unrealizedPnl)
          if (isLong) {
            accountRealizedLongPnl = accountRealizedLongPnl.add(realizedPnl).add(settlementPnl)
            accountUnrealizedLongPnl = accountUnrealizedLongPnl.add(unrealizedPnl)
            totalLongAverageCloseOrSettleCost = totalLongAverageCloseOrSettleCost.add(totalAverageCloseCost)
            if (isSettled) {
              // Include avg open cost on settled positions
              totalLongAverageCloseOrSettleCost = totalLongAverageCloseOrSettleCost.add(totalAverageOpenCost)
            } else {
              // Ignore avg open cost on settled positions
              totalLongAverageOpenCost = totalLongAverageOpenCost.add(totalAverageOpenCost)
            }
            totalLongPremiums = totalLongPremiums.add(
              position.trades().reduce((sum, trade) => sum.add(trade.premium), ZERO_BN)
            )
          }
          totalNotionalVolume = totalNotionalVolume.add(
            position.trades().reduce((sum, trade) => {
              const volume = trade.strikePrice.mul(trade.size).div(UNIT)
              return sum.add(volume)
            }, ZERO_BN)
          )
          totalPremiums = totalPremiums.add(position.trades().reduce((sum, trade) => sum.add(trade.premium), ZERO_BN))
        })

      const realizedLongPnlPercentage = totalLongAverageCloseOrSettleCost.gt(0)
        ? accountRealizedLongPnl.mul(UNIT).div(totalLongAverageCloseOrSettleCost)
        : ZERO_BN

      const unrealizedLongPnlPercentage = totalLongAverageOpenCost.gt(0)
        ? accountUnrealizedLongPnl.mul(UNIT).div(totalLongAverageOpenCost)
        : ZERO_BN

      return {
        account,
        realizedPnl: accountRealizedPnl,
        unrealizedPnl: accountUnrealizedPnl,
        realizedLongPnl: accountRealizedLongPnl,
        realizedLongPnlPercentage,
        unrealizedLongPnl: accountUnrealizedLongPnl,
        unrealizedLongPnlPercentage,
        totalPremiums,
        totalLongPremiums,
        totalNotionalVolume,
        positions,
      }
    })
    .filter(user => {
      if (minTotalPremiums && user.totalPremiums.lt(minTotalPremiums)) {
        return false
      }
      if (minTotalLongPremiums && user.totalLongPremiums.lt(minTotalLongPremiums)) {
        return false
      }
      return true
    })

  const secondarySortBy = options?.secondarySortBy
  if (secondarySortBy) {
    leaderboard.sort((a, b) => sortBy(a, b, secondarySortBy))
  }
  leaderboard.sort((a, b) => sortBy(a, b, options?.sortBy ?? PositionLeaderboardSortBy.RealizedPnl))

  return leaderboard
}
