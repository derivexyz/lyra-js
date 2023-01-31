import { BigNumber } from '@ethersproject/bignumber'
import yargs from 'yargs'

import fromBigNumber from '../src/utils/fromBigNumber'
import toBigNumber from '../src/utils/toBigNumber'
import getLyra from './utils/getLyra'

export default async function admin(argv: string[]) {
  const lyra = getLyra()
  const args = await yargs(argv).options({
    market: { type: 'string', alias: 'm', require: true },
  }).argv
  const market = await lyra.market(args.market)
  const admin = lyra.admin()
  const boards = market.liveBoards()
  const owner = await market.owner()
  const globalOwner = await admin.owner()

  console.log({ owner, globalOwner })
  const expiry = BigNumber.from('1653091199')
  const baseIV = toBigNumber(1)
  const strikePrices = [market.spotPrice]
  const skews = [toBigNumber(1)]

  const { board, tx } = await admin.addBoard(market.address, expiry, baseIV, strikePrices, skews)
  console.log({ board, tx })
  const { strike: strikeParams, tx: strikeTx } = await lyra
    .admin()
    .addStrikeToBoard(market.address, BigNumber.from(boards[0].id), strikePrices[0], skews[0])
  console.log({ strikeParams, strikeTx })

  const { params: newParams, tx: _greekCacheTx } = await admin.setGreekCacheParams(lyra.version, market.address, {
    maxStrikesPerBoard: toBigNumber(20),
  })
  console.log({
    greekCacheParams: {
      maxStrikePerBoard: fromBigNumber(newParams.maxStrikesPerBoard),
      gwavSkewCap: fromBigNumber(newParams.gwavSkewCap),
      gwavSkewFloor: fromBigNumber(newParams.gwavSkewFloor),
    },
  })

  // console.log({
  //   id: board.id,
  //   expiryTimestamp: board.expiryTimestamp,
  //   isExpired: board.isExpired,
  //   priceAtExpiry: board.priceAtExpiry ? fromBigNumber(board.priceAtExpiry) : null,
  //   strikes: board.strikes().map(s => ({
  //     id: s.id,
  //     strike: fromBigNumber(s.strikePrice),
  //     isDeltaInRange: s.isDeltaInRange,
  //   })),
  // })
}
