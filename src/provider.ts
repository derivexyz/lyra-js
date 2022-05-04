import { Block, BlockTag, StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { Deferrable } from 'ethers/lib/utils'

const callPromiseCache: Record<string, Promise<string>> = {}
const blockPromiseCache: Record<string, Promise<Block>> = {}
const latestBlockUpdateTimestamps: Record<number, number> = {}

const getBlockCacheKey = (chainId: number, blockTag: BlockTag) => {
  return `${chainId}-${blockTag}`
}

// Refresh latest block every 5 seconds
const LATEST_BLOCK_TIMEOUT = 5 * 1000

export default class LyraJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO: @earthtojake Put cache objects into provider object
  // async send(method: string, params: any[]): Promise<any> {
  //   console.count(method)
  //   return super.send(method, params)
  // }
  async call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag> | undefined
  ): Promise<string> {
    const chainId = this._network.chainId
    const { number: blockNumber } = await this.getBlock('latest')
    const key = [chainId, blockNumber, JSON.stringify(transaction)].join()
    callPromiseCache[key] = callPromiseCache[key] ?? super.call(transaction, blockTag)
    return callPromiseCache[key]
  }
  async getBlock(_blockHashOrBlockTag: BlockTag | Promise<BlockTag>, skipCache?: boolean): Promise<Block> {
    const blockHashOrBlockTag = await _blockHashOrBlockTag
    const chainId = this._network.chainId
    const cacheKey = getBlockCacheKey(chainId, blockHashOrBlockTag)
    if (blockHashOrBlockTag === 'latest') {
      const now = Date.now()
      if (
        skipCache ||
        !blockPromiseCache[cacheKey] ||
        now > latestBlockUpdateTimestamps[chainId] + LATEST_BLOCK_TIMEOUT
      ) {
        // Query latest block
        blockPromiseCache[cacheKey] = super.getBlock(blockHashOrBlockTag)
        latestBlockUpdateTimestamps[chainId] = now
      }
      const block = await blockPromiseCache[cacheKey]
      blockPromiseCache[getBlockCacheKey(chainId, block.number)] = new Promise(resolve => resolve(block))
      return block
    } else if (typeof blockHashOrBlockTag === 'number') {
      // Query specific block
      if (!blockPromiseCache[cacheKey]) {
        blockPromiseCache[cacheKey] = super.getBlock(blockHashOrBlockTag)
      }
      const block = await blockPromiseCache[cacheKey]
      return block
    } else {
      console.warn("Querying block that isn't specified or latest")
      return await super.getBlock(blockHashOrBlockTag)
    }
  }
}
