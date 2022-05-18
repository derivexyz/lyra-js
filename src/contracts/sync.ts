import syncABIs from './syncABIs'
import syncAddresses from './syncAddresses'

// TODO: @earthtojake Replace sync script with lyrafinance/protocol package
async function sync(argv: string[]) {
  await syncABIs(argv)
  await syncAddresses(argv)
}

sync(process.argv).then(() => {
  process.exit()
})
