import { Chain, Version } from '..'

export default function getDefaultVersionForChain(chain: Chain): Version {
  switch (chain) {
    case Chain.Arbitrum:
    case Chain.ArbitrumGoerli:
    case Chain.Optimism:
    case Chain.OptimismGoerli:
      return Version.Newport
  }
}
