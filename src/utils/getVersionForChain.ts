import { Network, Version } from '..'

export default function getVersionForChain(network: Network): Version {
  switch (network) {
    case Network.Arbitrum:
      return Version.Newport
    case Network.Optimism:
      return Version.Avalon
  }
}
