import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-dependency-compiler';

import { lyraContractPaths } from '@lyrafinance/protocol/dist/test/utils/package/index-paths';

export default {
  networks: {
    hardhat: {},
    local: {
      url: 'http://127.0.0.1:8545',
      gasPrice: 0,
    },
    'kovan-ovm': {
      url: 'https://kovan.optimism.io',
      ovm: true,
    },
  },
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  dependencyCompiler: {
    paths: lyraContractPaths,
  },
};
