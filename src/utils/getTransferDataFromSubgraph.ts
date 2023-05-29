import { getAddress } from '@ethersproject/address'

import { DataSource } from '../constants/contracts'
import { TransferQueryResult } from '../constants/queries'
import { TransferEventData } from '../transfer_event'

export default function getTransferDataFromSubgraph(transfer: TransferQueryResult): TransferEventData {
  return {
    source: DataSource.Subgraph,
    from: getAddress(transfer.oldOwner),
    to: getAddress(transfer.newOwner),
    transactionHash: transfer.transactionHash,
    blockNumber: transfer.blockNumber,
    positionId: transfer.position.positionId,
    marketAddress: getAddress(transfer.position.id.split('-')[0]),
  }
}
