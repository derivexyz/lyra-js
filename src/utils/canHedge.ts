import { BigNumber } from 'ethers'

import { Network, PoolHedgerParams } from '..'
import { GMXFuturesPoolHedger } from '../contracts/newport/typechain/NewportGMXFuturesPoolHedger'
import { SNXPerpsV2PoolHedger } from '../contracts/newport/typechain/NewportSNXPerpsV2PoolHedger'
import { PoolHedgerView } from '../market'
import { Option } from '../option'
import canHedgeOnArbitrum from './canHedgeArbitrum'
import canHedgeOnOptimism from './canHedgeOptimism'

export default function canHedge(
  quoteSpotPrice: BigNumber,
  netDelta: BigNumber,
  option: Option,
  size: BigNumber,
  increasesPoolDelta: boolean,
  hedgerView: PoolHedgerView,
  poolHedgerParams: PoolHedgerParams,
  network: Network
): boolean {
  switch (network) {
    case Network.Arbitrum:
      return canHedgeOnArbitrum(
        quoteSpotPrice,
        netDelta,
        option,
        size,
        increasesPoolDelta,
        hedgerView as GMXFuturesPoolHedger.GMXFuturesPoolHedgerViewStructOutput,
        poolHedgerParams
      )
    case Network.Optimism:
      return canHedgeOnOptimism(
        quoteSpotPrice,
        netDelta,
        option,
        size,
        increasesPoolDelta,
        hedgerView as SNXPerpsV2PoolHedger.HedgerStateStructOutput,
        poolHedgerParams
      )
  }
}
