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
import CircleService from './services/circleService';
import USDCWatcher from './services/usdcWatcher';

registerLogger(new SampleServerLogger());
initDB();

const PORT = process.env.PORT ?? 8080;

// Global state for monitoring
let watcher = null;
let contractAddresses = [];
let circleService = null;

// Configuration for monitoring
const monitoringConfig = {
  rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
  wsUrl: `wss://sepolia.infura.io/ws/v3/${process.env.INFURA_API_KEY}`,
  get contractAddresses() {
    return contractAddresses;
  },
  set contractAddresses(newAddresses) {
    contractAddresses = newAddresses;
  },
  usdcAddress: process.env.USDC_ADDRESS,
  circleApiKey: process.env.CIRCLE_API_KEY,
  circleWalletId: process.env.CIRCLE_WALLET_ID,
  processHistoricalTransfers:
    process.env.PROCESS_HISTORICAL_TRANSFERS === 'true'
};

// Welcome route
app.get('/', (req, res) => {
  res.json({
    service: 'USDC Auto-Splitter API',
    status: watcher?.isRunning ? 'running' : 'stopped',
    contracts: contractAddresses.length,
    transfersDetected: watcher?.eventsDetected || 0,
    splitsExecuted: watcher?.splitsExecuted || 0
  });
});

async function loadContractsFromAPI() {
  try {
    // Validate environment configuration
    if (!process.env.CIRCLE_API_KEY) {
      console.log(
        '❌ CIRCLE_API_KEY not configured - contract discovery disabled'
      );
      contractAddresses = [];
      return;
    }

    if (!process.env.INFURA_API_KEY && !process.env.INFURA_RPC_URL) {
      console.log(
        '❌ INFURA_API_KEY not configured - blockchain validation disabled'
      );
      contractAddresses = [];
      return;
    }

    // Initialize circle service for webhook auto-split
    if (!circleService) {
      circleService = new CircleService(monitoringConfig);
    }

    // Try to load from storage first
    const CircleApiService = require('./services/circleApiService');
    contractAddresses = await CircleApiService.loadContractsFromStorage();

    // If no stored contracts, fetch from API
    if (contractAddresses.length === 0) {
      console.log('📡 No cached contracts - fetching from Circle API...');
      contractAddresses = await CircleApiService.fetchContractAddresses();
    } else {
      console.log(
        `📦 Loaded ${contractAddresses.length} contracts from storage`
      );
    }

    if (contractAddresses.length === 0) {
      console.log('⚠️ No contracts available for monitoring');
    }
  } catch (error) {
    console.log(`❌ Contract loading failed: ${error.message}`);
    console.log('💡 System will continue with empty contract list');
    contractAddresses = [];
  }
}

// const server = app.listen(port, () => {
//   logger.info(`Server is running at http://localhost:${port}`);
// });

const server = app.listen(PORT, async () => {
  console.log(`🚀 USDC Auto-Splitter Server`);
  console.log(`==================================`);
  // Load contracts and start monitoring
  await loadContractsFromAPI();

  // Initialize and start the watcher if contracts are available
  if (contractAddresses.length > 0) {
    try {
      circleService = new CircleService(monitoringConfig);
      watcher = new USDCWatcher(monitoringConfig, circleService);
      await watcher.start();
    } catch (error) {
      console.log(`❌ Failed to start watcher: ${error.message}`);
    }
  }

  console.log(
    `🚀 Server ready - ${contractAddresses.length} contracts loaded with automatic monitoring`
  );
});
process.on('SIGINT', function () {
  cleanupDB();
  server.close();
  logger.info('Server closed successfully');
});
