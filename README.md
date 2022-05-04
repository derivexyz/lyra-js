# Setup

## 1. Setup lyra repo

```
git clone https://github.com/lyra-finance/lyra.git
git checkout post_regenesis
```

## 2. Deploy local contracts

```
npx hardhat node
yarn deployAndSeed // new window
```

## 3. Sync local contracts

```
git clone https://github.com/lyra-finance/lyra-dapp.git
git checkout avalon
cd sdk
// only need to run these two steps after setup
yarn sync-abis --env local
yarn sync-addresses --env local
```

## 4. Test SDK

Create `<file>` in `sdk/src/scripts`

Run `yarn script <file>`

See example in `sdk/scr/scripts/quote`
