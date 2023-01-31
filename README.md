# Lyra.js

A JavaScript SDK for the [Lyra Protocol](https://docs.lyra.finance/). Wraps around [Ethers.js](https://docs.ethers.io/v5/). Works in the web browser and Node.js.

[Documentation](https://docs.lyra.finance/developers/tools/lyra.js)

[Guides](https://docs.lyra.finance/developers/guides/execute-a-trade-off-chain)

⚠️ This SDK is in open alpha and is constantly under development. USE AT YOUR OWN RISK.

## Install

```
yarn add @lyrafinance/lyra-js
```

## Quickstart

Read Lyra's market data.

```typescript
import Lyra, { Chain } from '@lyrafinance/lyra-js'

const lyra = new Lyra(Chain.Optimism)

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
import Lyra, { Chain, TradeEvent } from '@lyrafinance/lyra-js'

const lyra = new Lyra(Chain.Arbitrum)

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

// Prepare trade (Open 1.0 Long ETH Call with 0.1% slippage)
const trade = await lyra.trade(account.address, 'eth', strike.id, true, true, ONE_BN, 0.1 / 100)

// Approve USDC
const approveTx = await trade.approveQuote(signer.address, MAX_BN)
const approveResponse = await signer.sendTransaction(approveTx)
await approveResponse.wait()
console.log('Approved USDC:', approveResponse.hash)

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
import Lyra, { Chain } from '@lyrafinance/lyra-js'

const lyra = new Lyra(Chain.Arbitrum)

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

### Run Script

To run a script, first clone the lyra-js repository

```
git clone https://github.com/lyra-finance/lyra-js.git
cd lyra-js
```

Install dependencies locally

```
yarn install
```

Choose a script and run

```
yarn script <script>
yarn script markets
yarn script simple-trade
```
