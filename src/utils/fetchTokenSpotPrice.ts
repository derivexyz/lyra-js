import { Contract } from '@ethersproject/contracts'

import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import {
  Deployment,
  ONE_INCH_ORACLE_OPTIMISM_MAINNET_ADDRESS,
  USDC_OPTIMISM_MAINNET_ADDRESS,
  USDC_OPTIMISM_MAINNET_DECIMALS,
} from '../constants/contracts'
import ONE_INCH_OFFCHAIN_ORACLE_ABI from '../contracts/abis/OneInchOffChainOracle.json'
import fromBigNumber from './fromBigNumber'

export default async function fetchTokenSpotPrice(lyra: Lyra, tokenNameOrAddress: string): Promise<number> {
  // BLOCK: remove before merging
  if (lyra.deployment === Deployment.Kovan) {
    return 0.05
  }
  const oneInchOffchainOracle = new Contract(
    ONE_INCH_ORACLE_OPTIMISM_MAINNET_ADDRESS,
    ONE_INCH_OFFCHAIN_ORACLE_ABI,
    lyra.provider
  )
  const data = await oneInchOffchainOracle.getRate(tokenNameOrAddress, USDC_OPTIMISM_MAINNET_ADDRESS, false)
  return fromBigNumber(data ?? ZERO_BN, USDC_OPTIMISM_MAINNET_DECIMALS)
}
