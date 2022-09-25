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
      const longPnls = positions.filter(pos => pos.isLong).map(p => p.pnl())
      const shortPnls = positions.filter(pos => !pos.isLong).map(p => p.pnl())
      const pnls = [...longPnls, ...shortPnls]

      const realizedPnl = pnls.reduce((sum, { realizedPnl, settlementPnl }) => {
        return sum.add(realizedPnl).add(settlementPnl)
      }, ZERO_BN)

      const realizedLongPnl = longPnls.reduce((sum, { realizedPnl, settlementPnl }) => {
        return sum.add(realizedPnl).add(settlementPnl)
      }, ZERO_BN)

      const unrealizedPnl = pnls.reduce((sum, { unrealizedPnl }) => {
        return sum.add(unrealizedPnl)
      }, ZERO_BN)

      const unrealizedLongPnl = longPnls.reduce((sum, { unrealizedPnl }) => {
        return sum.add(unrealizedPnl)
      }, ZERO_BN)

      // Include avg open cost on settled positions
      const totalLongAverageCloseOrSettleCost = positions
        .filter(p => p.isLong)
        .reduce((sum, position) => {
          const { isSettled } = position
          const { totalAverageCloseCost, totalAverageOpenCost } = position.pnl()
          return isSettled ? sum.add(totalAverageCloseCost).add(totalAverageOpenCost) : sum.add(totalAverageCloseCost)
        }, ZERO_BN)

      const realizedLongPnlPercentage = totalLongAverageCloseOrSettleCost.gt(0)
        ? realizedPnl.mul(UNIT).div(totalLongAverageCloseOrSettleCost)
        : ZERO_BN

      // Ignore avg open cost on settled positions
      const totalLongAverageOpenCost = positions
        .filter(p => p.isLong)
        .reduce((sum, position) => {
          const { isSettled } = position
          const { totalAverageOpenCost } = position.pnl()
          return isSettled ? sum : sum.add(totalAverageOpenCost)
        }, ZERO_BN)

      const unrealizedLongPnlPercentage = totalLongAverageOpenCost.gt(0)
        ? unrealizedPnl.mul(UNIT).div(totalLongAverageOpenCost)
        : ZERO_BN

      const totalPremiums = positions.reduce(
        (sum, pos) => sum.add(pos.trades().reduce((sum, trade) => sum.add(trade.premium), ZERO_BN)),
        ZERO_BN
      )

      const totalNotionalVolume = positions.reduce(
        (sum, pos) =>
          sum.add(
            pos.trades().reduce((sum, trade) => {
              const volume = trade.strikePrice.mul(trade.size).div(UNIT)
              return sum.add(volume)
            }, ZERO_BN)
          ),
        ZERO_BN
      )

      return {
        account,
        realizedPnl,
        unrealizedPnl,
        realizedLongPnl,
        realizedLongPnlPercentage,
        unrealizedLongPnl,
        unrealizedLongPnlPercentage,
        totalPremiums,
        totalNotionalVolume,
        positions,
      }
    }, {})
    .filter(user => {
      if (minTotalPremiums && user.totalPremiums.lt(minTotalPremiums)) {
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
