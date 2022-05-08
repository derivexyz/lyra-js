# Lyra.js

A JavaScript SDK for [Optimistic Ethereum](https://optimism.io/) and the [Lyra Protocol](https://docs.lyra.finance/). Wraps around [Ethers.js](https://docs.ethers.io/v5/). Works in the web browser and Node.js.

_Documentation coming soon._

⚠️ This SDK is in open alpha for Optimistic Kovan testnet, and is constantly under development. USE AT YOUR OWN RISK.

## Install

```
yarn add @lyrafinance/lyra-js
```

## Quickstart

Read Lyra's market data with zero configuration.

```typescript
import Lyra from '@lyrafinance/lyra-js'

const lyra = new Lyra()

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
```

## Executing trades

Prepare and execute trades with a simple interface.

```typescript
import Lyra, { TradeEvent } from '@lyrafinance/lyra-js'

const lyra = new Lyra()

// Initialize account
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, lyra.provider)
const account = lyra.account(signer.address)

const market = await lyra.market('eth')

// Select most recent expiry
const board = market.liveBoards()[0]

// Select first strike in delta range
const strike = board.strikes().find(strike => strike.isDeltaInRange)
if (!strike) {
  throw new Error('No strike in delta range')
}

// Approve
const approveTx = await account.approveStableToken(market.quoteToken.address, MAX_BN)
const approveResponse = await signer.sendTransaction(approveTx)
await approveResponse.wait()
console.log('Approved sUSD')

// Prepare trade (Open 1.0 Long ETH Call)
const trade = await Trade.get(lyra, account.address, 'eth', strike.id, true, true, ONE_BN, {
  premiumSlippage: 0.1 / 100, // 0.1%
})

// Check if trade is disabled
if (!trade.tx) {
  throw new Error(`Trade is disabled: ${trade.disabledReason}`)
}

// Execute trade
const tradeResponse = await signer.sendTransaction(trade.tx)
console.log('Executed trade:', tradeResponse.hash)
const tradeReceipt = await tradeResponse.wait()

// Get trade result
const tradeEvent = (await TradeEvent.getByHash(lyra, tradeReceipt.transactionHash))[0]

printObject('Trade Result', {
  blockNumber: tradeEvent.blockNumber,
  positionId: tradeEvent.positionId,
  premium: tradeEvent.premium,
  fee: tradeEvent.fee,
})
```

## Listeners

Create trade feeds across all markets with a simple listener

```typescript
import Lyra from '@lyrafinance/lyra-js'

const lyra = new Lyra()

lyra.onTrade(trade => {
  console.log({
    trader: trade.trader,
    positionId: trade.positionId,
    market: trade.marketName,
    size: trade.size,
    isBuy: trade.isBuy,
    isLong: trade.isLong,
    premium: trade.premium,
    setCollateralTo: trade.setCollateralTo,
    isLiquidation: trade.isLiquidation,
  })
})
```

## Examples

See the `src/scripts` directory for more examples of SDK interactions.
