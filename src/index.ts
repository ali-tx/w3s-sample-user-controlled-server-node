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
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Web3 from 'web3';
import USDCWatcher from './services/usdcWatcher';
import CircleService from './services/circleService';
dotenv.config();

registerLogger(new SampleServerLogger());
initDB();

const PORT = process.env.PORT ?? 8080;

// / Load contracts from Circle API
let contractAddresses: string[] = [];

// Configuration
interface AppConfig {
  rpcUrl: string;
  contractAddresses: string[];
  usdcAddress: string;
  circleApiKey: string;
  circleWalletId: string;
  minSplitAmount: number;
  processHistoricalTransfers: boolean;
}

const config: AppConfig = {
  rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
  get contractAddresses(): string[] {
    return contractAddresses;
  },
  set contractAddresses(newAddresses: string[]) {
    contractAddresses = newAddresses;
  },
  usdcAddress: process.env.USDC_ADDRESS || '',
  circleApiKey: process.env.CIRCLE_API_KEY || '',
  circleWalletId: process.env.CIRCLE_WALLET_ID || '',
  minSplitAmount: parseInt(process.env.MIN_SPLIT_AMOUNT || '300000'),
  processHistoricalTransfers:
    process.env.PROCESS_HISTORICAL_TRANSFERS === 'true'
};

// Validate required environment variables
const requiredEnvVars = [
  'INFURA_API_KEY',
  'USDC_ADDRESS',
  'CIRCLE_API_KEY',
  'CIRCLE_WALLET_ID'
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Load contracts from Circle API
async function loadContractsFromAPI(): Promise<void> {
  try {
    contractAddresses = await circleService.fetchContractsFromTransactions();
  } catch (error: any) {
    console.error('Failed to load contracts from API:', error.message);
    contractAddresses = [];
  }
}

// Services
let watcher: USDCWatcher | null = null;
const circleService = new CircleService(config);

// Middleware
app.use(express.json());

// ========== STATUS ENDPOINTS ==========
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'USDC Auto-Splitter',
    contracts: config.contractAddresses,
    status: watcher?.getStats().isRunning ? 'running' : 'stopped',
    endpoints: {
      contracts: 'GET /contracts, POST /contracts, DELETE /contracts/:address',
      start: 'POST /start',
      stop: 'POST /stop',
      status: 'GET /status',
      balance: 'GET /balance',
      manual: 'POST /split'
    }
  });
});

app.get('/status', (req: Request, res: Response) => {
  const stats = watcher?.getStats() || {
    isRunning: false,
    lastBlock: 0,
    eventsDetected: 0,
    splitsExecuted: 0,
    lastChecked: null
  };

  res.json({
    running: stats.isRunning,
    contracts: config.contractAddresses,
    eventsDetected: stats.eventsDetected,
    splitsExecuted: stats.splitsExecuted,
    lastChecked: stats.lastChecked || 'never'
  });
});

// ========== BALANCE CHECK ==========
app.get('/balance', async (req: Request, res: Response) => {
  try {
    const web3 = new Web3(config.rpcUrl);
    const usdcContract = new web3.eth.Contract(
      [
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }
      ] as any,
      config.usdcAddress
    );

    const balances: Array<{
      contract: string;
      balance: string;
      balanceUSDC: string;
    }> = [];

    for (const contractAddress of config.contractAddresses) {
      const balance = await usdcContract.methods
        .balanceOf(contractAddress)
        .call();
      const balanceUSDC = parseInt(balance as string) / 1000000;
      balances.push({
        contract: contractAddress,
        balance: balance.toString(),
        balanceUSDC: balanceUSDC.toFixed(6)
      });
    }

    res.json({ balances });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CONTROL ENDPOINTS ==========
app.post('/start', (req: Request, res: Response) => {
  try {
    if (watcher) {
      watcher.stop();
    }

    watcher = new USDCWatcher(config, circleService);
    watcher.start();

    res.json({
      status: 'started',
      message: 'Watching for USDC transfers to your contract'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/stop', (req: Request, res: Response) => {
  try {
    if (watcher) {
      watcher.stop();
      watcher = null;
    }

    res.json({ status: 'stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CONTRACT MANAGEMENT ==========
app.get('/contracts', (req: Request, res: Response) => {
  res.json({
    contracts: config.contractAddresses,
    count: config.contractAddresses.length
  });
});

interface AddContractRequest {
  address: string;
}

app.post(
  '/contracts',
  (req: Request<{}, {}, AddContractRequest>, res: Response) => {
    const { address } = req.body;

    // Validate Ethereum address
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!address || !ethAddressRegex.test(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    if (config.contractAddresses.includes(address)) {
      return res.status(400).json({ error: 'Contract already exists' });
    }

    config.contractAddresses = [...config.contractAddresses, address];

    // Restart watcher to include new contract
    if (watcher) {
      watcher.stop();
      watcher = new USDCWatcher(config, circleService);
      watcher.start();
    }

    res.json({ status: 'added', contract: address });
  }
);

app.delete(
  '/contracts/:address',
  (req: Request<{ address: string }>, res: Response) => {
    const { address } = req.params;

    if (!config.contractAddresses.includes(address)) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    config.contractAddresses = config.contractAddresses.filter(
      (addr) => addr !== address
    );

    // Restart watcher to exclude removed contract
    if (watcher) {
      watcher.stop();
      watcher = new USDCWatcher(config, circleService);
      watcher.start();
    }

    res.json({ status: 'removed', contract: address });
  }
);

// ========== MANUAL SPLIT ==========
interface SplitRequest {
  amount: number;
  contractAddress?: string;
}

interface SplitResponse {
  status: string;
  contract: string;
  transactionId?: string;
  amount: number;
  split: {
    fee: string;
    receive: string;
  };
}

app.post(
  '/split',
  async (
    req: Request<{}, {}, SplitRequest>,
    res: Response<SplitResponse | { error: string }>
  ) => {
    try {
      const { amount, contractAddress } = req.body;
      const targetContract = contractAddress || config.contractAddresses[0];

      if (!amount || amount < config.minSplitAmount) {
        return res.status(400).json({
          error: `Amount must be at least ${config.minSplitAmount} (0.30 USDC)`
        });
      }

      if (!config.contractAddresses.includes(targetContract)) {
        return res.status(400).json({
          error: `Contract address not in configured list`
        });
      }

      const result = await circleService.executeSplit(amount, targetContract);

      const response: SplitResponse = {
        status: 'success',
        contract: targetContract,
        transactionId: result.transactionId,
        amount: amount,
        split: {
          fee: '0.30 USDC → 0x2ae66ef71ec7c455939944b10782ce4Ec03c49c1',
          receive: `${(amount - 300000) / 1000000} USDC → 0x105fe877e09F1eeEA65a2Cc407a9df5942E4737F`
        }
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// const server = app.listen(port, () => {
//   logger.info(`Server is running at http://localhost:${port}`);
// });

// ========== START SERVER ==========
const server = // ... existing imports and setup ...
  // ========== START SERVER ==========
  app.listen(PORT, async () => {
    console.log(`
🚀 USDC Auto-Splitter Application
==================================
✅ Server: http://localhost:${PORT}
📝 Contracts: ${config.contractAddresses.length} loaded
💰 USDC: ${config.usdcAddress}

📋 Endpoints:
   GET  /contracts - List contracts
   POST /contracts - Add contract
   POST /start     - Start watching
   POST /stop      - Stop watching
   POST /split     - Manual split
   GET  /status    - Check status
  `);

    // Load initial contracts
    await loadContractsFromAPI();

    // Only start watcher if we have contracts
    if (config.contractAddresses.length > 0) {
      console.log(
        `👀 Starting watcher with ${config.contractAddresses.length} contracts`
      );
      watcher = new USDCWatcher(config, circleService);
      watcher.start();
    } else {
      console.log('⚠️ No contracts loaded. Watcher not started.');
      console.log(
        'ℹ️ Use POST /contracts to add contracts manually or wait for automatic refresh.'
      );
    }

    // Refresh contracts every 10 minutes (last 24h data)
    setInterval(
      async () => {
        console.log('🔄 Refreshing contracts from Circle API (last 24h)...');
        await loadContractsFromAPI();
        console.log(
          `✅ Contracts refreshed: ${config.contractAddresses.length} contracts`
        );

        // Restart watcher with new contracts if we have any
        if (config.contractAddresses.length > 0) {
          if (watcher) {
            watcher.stop();
          }
          watcher = new USDCWatcher(config, circleService);
          watcher.start();
        }
      },
      10 * 60 * 1000
    ); // 10 minutes
  });

export default app;

process.on('SIGINT', function () {
  cleanupDB();
  server.close();
  logger.info('Server closed successfully');
});

//data ure
