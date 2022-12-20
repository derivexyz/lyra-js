import { BigNumber, Contract } from 'ethers'

import Lyra from '..'
import { LyraContractId } from '../constants/contracts'
import getLyraContract from './getLyraContract'

type MulticallData = {
  callData: string
  contract: Contract
  functionFragment: string
}

type MulticallResponse = BigNumber | Record<string, any>[]

export default async function callContractWithMulticall<MulticallResponse>(
  lyra: Lyra,
  multicallData: MulticallData[]
): Promise<MulticallResponse> {
  const multicall3Contract = getLyraContract(lyra, LyraContractId.Multicall3)
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
