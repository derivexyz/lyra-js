import { Contract } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import Lyra from '..'
import { ZERO_BN } from '../constants/bn'
import ONE_INCH_OFFCHAIN_ORACLE_ABI from '../contracts/abis/OneInchOffChainOracle.json'
import fromBigNumber from './fromBigNumber'
import toBigNumber from './toBigNumber'

const ONE_INCH_ORACLE_OPTIMISM_ADDRESS = '0x11DEE30E710B8d4a8630392781Cc3c0046365d4c'
const LYRA_OPTIMISM_ADDRESS = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'
const USDC_OPTIMISM_ADDRESS = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
const USDC_OPTIMISM_DECIMALS = 6

export default async function fetchLyraTokenSpotPrice(lyra: Lyra): Promise<BigNumber> {
  const oneInchOffchainOracle = new Contract(
    ONE_INCH_ORACLE_OPTIMISM_ADDRESS,
    ONE_INCH_OFFCHAIN_ORACLE_ABI,
    lyra.provider
  )
  const data = await oneInchOffchainOracle.getRate(LYRA_OPTIMISM_ADDRESS, USDC_OPTIMISM_ADDRESS, false)
  const spotPrice = toBigNumber(fromBigNumber(data ?? ZERO_BN, USDC_OPTIMISM_DECIMALS))
  return spotPrice
}
