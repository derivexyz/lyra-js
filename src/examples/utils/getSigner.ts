import { Wallet } from '@ethersproject/wallet'

import Lyra from '../../lyra'

export type ScriptLyra = {
  lyra: Lyra
  signer: Wallet
}

export default function getSigner(lyra: Lyra): Wallet {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is missing in environment')
  }
  return new Wallet(privateKey, lyra.provider)
}
