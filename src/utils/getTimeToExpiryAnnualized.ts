import { Board } from '../board'

export default function getTimeToExpiryAnnualized(board: Board) {
  const timeToExpiry = board.timeToExpiry
  const timeToExpiryAnnualized = timeToExpiry / (60 * 60 * 24 * 365)
  return timeToExpiryAnnualized
}
