import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import {
  Deployment,
  ONE_INCH_ORACLE_OPTIMISM_MAINNET_ADDRESS,
  USDC_OPTIMISM_MAINNET_ADDRESS,
  USDC_OPTIMISM_MAINNET_DECIMALS,
} from '../constants/contracts'
import ONE_INCH_OFFCHAIN_ORACLE_ABI from '../contracts/common/abis/OneInchOffChainOracle.json'
import fromBigNumber from './fromBigNumber'

export default async function fetchTokenSpotPrice(
  lyra: Lyra,
  tokenNameOrAddress: string,
  options?: {
    oracleAddress?: string
    customProvider?: JsonRpcProvider
    stableCoinAddress?: string
    stableCoinDecimals?: number
  }
): Promise<number> {
  // use governance provider -> lyra.optimismProvider
  // BLOCK: remove before merging
  if (lyra.deployment === Deployment.Testnet) {
    return 0.05
  }
  const oneInchOffchainOracle = new Contract(
    options?.oracleAddress ?? ONE_INCH_ORACLE_OPTIMISM_MAINNET_ADDRESS,
    ONE_INCH_OFFCHAIN_ORACLE_ABI,
    options?.customProvider ?? lyra.optimismProvider
  )
  const data = await oneInchOffchainOracle.getRate(
    tokenNameOrAddress,
    options?.stableCoinAddress ?? USDC_OPTIMISM_MAINNET_ADDRESS,
    false
  )
  return fromBigNumber(data ?? ZERO_BN, options?.stableCoinDecimals ?? USDC_OPTIMISM_MAINNET_DECIMALS)
}
