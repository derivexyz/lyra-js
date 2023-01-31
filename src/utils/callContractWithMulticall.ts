import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract } from 'ethers'

import Lyra from '..'
import { LyraGlobalContractId } from '../constants/contracts'
import getGlobalContract from './getGlobalContract'

type MulticallData = {
  callData: string
  contract: Contract
  functionFragment: string
}

export default async function callContractWithMulticall<MulticallResponse>(
  lyra: Lyra,
  multicallData: MulticallData[],
  useCustomProvider?: JsonRpcProvider
): Promise<MulticallResponse> {
  const multicall3Contract = getGlobalContract(
    lyra,
    LyraGlobalContractId.Multicall3,
    useCustomProvider ? useCustomProvider : lyra.provider
  )
  const calls = multicallData.map(data => {
    return {
      target: data.contract.address,
      callData: data.callData,
    }
  })
  const multicallResponse = await multicall3Contract.callStatic.aggregate(calls)
  let responseCount = 0
  const result = multicallData.reduce((result, data) => {
    const contract = data.contract
    const functionResult = contract.interface.decodeFunctionResult(
      data.functionFragment,
      multicallResponse[1][responseCount]
    )
    responseCount++
    result.push(functionResult)
    return result
  }, [] as any)
  return result
}
