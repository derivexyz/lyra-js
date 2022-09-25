import { ZERO_ADDRESS } from '../constants/bn'
import { LyraContractId } from '../constants/contracts'
import Lyra from '../lyra'
import getLyraContract from './getLyraContract'

type MarketAddressToId = {
  [marketAddress: string]: number
}

export default async function getOptionWrapperMarketIds(lyra: Lyra): Promise<MarketAddressToId> {
  const wrapper = getLyraContract(lyra.provider, lyra.deployment, LyraContractId.OptionMarketWrapper)
  const [_, marketBalances] = await wrapper.getBalancesAndAllowances(ZERO_ADDRESS)
  const marketToId = marketBalances.reduce(
    (marketToId: MarketAddressToId, marketAssetView) => ({
      ...marketToId,
      [marketAssetView.market]: marketAssetView.id,
    }),
    {}
  )
  return marketToId
}
