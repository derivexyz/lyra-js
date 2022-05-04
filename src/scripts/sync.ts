import syncABIs from './sync-abis'
import syncAddresses from './sync-addresses'

export default async function sync(argv: string[]) {
  await syncABIs(argv)
  await syncAddresses(argv)
}
