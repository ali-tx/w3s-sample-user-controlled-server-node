// Copyright (c) 2024, Circle Technologies, LLC. All rights reserved.
//
import dotenv from 'dotenv';
dotenv.config();

// Copyright (c) 2024, Circle Technologies, LLC. All rights reserved.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { app } from './app';
import { initDB, cleanupDB } from './services/db/sqlite/sqliteDB';
import {
  logger,
  registerLogger,
  SampleServerLogger
} from './services/logging/logger';
import config from './config';
import USDCWatcher from './services/usdcWatcher';
import CircleService from './services/circleService';
import Web3 from 'web3';

registerLogger(new SampleServerLogger());
initDB();

const circleService = new CircleService({
  circleWalletId: config.CIRCLE_WALLET_ID!,
  circleApiKey: config.CIRCLE_API_KEY!
});

// Function to fetch contracts from Circle API
async function fetchContracts() {
  let contractData: { id: string; address: string }[] = [];
  try {
    const circleApiService = await import(
      './services/external/circleApiService.js'
    );
    const allContracts: unknown[] = [];
    let page = 1;
    const limit = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const contractsResp = await circleApiService.get(
        `/v1/w3s/contracts?page=${page}&limit=${limit}`
      );
      logger.info(`Contracts from API page ${page}:`, contractsResp.data);
      const contracts =
        contractsResp.data?.data?.contracts ||
        contractsResp.data?.contracts ||
        contractsResp.data ||
        [];
      logger.info(`Contracts array length page ${page}:`, contracts.length);
      if (contracts.length === 0) break;
      allContracts.push(...contracts);
      page++;
      if (contracts.length < limit) break; // Assuming if less than limit, it's the last page
    }
    const contracts = allContracts;
    logger.info('Total contracts fetched:', contracts.length);
    if (contracts.length > 0) {
      logger.info('First contract:', contracts[0]);
    }
    contractData = contracts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => {
        const addr = c.address || c.contractAddress;
        return addr && Web3.utils.isAddress(addr);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.id,
        address: Web3.utils.toChecksumAddress(c.address || c.contractAddress)
      }));
  } catch (apiErr: unknown) {
    logger.warn(
      'Failed to fetch contracts from Circle API',
      (apiErr as Error).message
    );
    contractData = [];
  }
  return contractData;
}

// Start USDC watcher if enabled
if (config.START_USDC_WATCHER && config.INFURA_RPC_URL) {
  (async () => {
    try {
      // Fetch deployed contracts from Circle API
      const contractData = await fetchContracts();
      const contractAddresses = contractData.map((d) => d.address);

      if (contractAddresses.length > 0) {
        logger.info(
          `Starting USDC Watcher with ${contractAddresses.length} contracts:`,
          contractAddresses
        );
        const watcher = new USDCWatcher(
          {
            rpcUrl: config.INFURA_RPC_URL as string,
            usdcAddress: config.USDC_ADDRESS,
            contractData: contractData,
            processHistoricalTransfers: config.PROCESS_HISTORICAL_TRANSFERS
          },
          circleService
        );
        logger.info('USDCWatcher instance created, calling start()');
        await watcher.start();
        logger.info(
          `USDC Watcher started successfully, watching ${contractAddresses.length} contracts`
        );

        // Update contracts every 2 minutes
        setInterval(
          async () => {
            try {
              const newContractData = await fetchContracts();
              watcher.updateContractData(newContractData);
              logger.info(
                `Updated USDC Watcher with ${newContractData.length} contracts`
              );
            } catch (updateErr: unknown) {
              logger.error(
                'Failed to update contracts',
                (updateErr as Error).message
              );
            }
          },
          2 * 60 * 1000
        ); // 2 minutes
      } else {
        logger.info(
          'USDC Watcher enabled but no deployed contracts with addresses found in Circle API'
        );
      }
    } catch (err: unknown) {
      logger.error('Failed to start USDC Watcher', (err as Error).message);
    }
  })();
} else if (config.START_USDC_WATCHER && !config.INFURA_RPC_URL) {
  logger.info('INFURA_RPC_URL not configured, skipping USDC Watcher start');
}

const port = config.PORT ?? 8080;
const server = app.listen(port, () => {
  logger.info(`Server is running at http://demo.monerepay.com:${port}`);
});

process.on('SIGINT', function () {
  cleanupDB();
  server.close();
  logger.info('Server closed successfully');
});
