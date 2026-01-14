"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Copyright (c) 2024, Circle Technologies, LLC. All rights reserved.
//
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
const app_1 = require("./app");
const sqliteDB_1 = require("./services/db/sqlite/sqliteDB");
const logger_1 = require("./services/logging/logger");
const config_1 = __importDefault(require("./config"));
const usdcWatcher_1 = __importDefault(require("./services/usdcWatcher"));
const circleService_1 = __importDefault(require("./services/circleService"));
const web3_1 = __importDefault(require("web3"));
const circleApiService_1 = __importDefault(require("./services/external/circleApiService"));
(0, logger_1.registerLogger)(new logger_1.SampleServerLogger());
(0, sqliteDB_1.initDB)();
const circleService = new circleService_1.default({
    circleWalletId: config_1.default.CIRCLE_WALLET_ID,
    circleApiKey: config_1.default.CIRCLE_API_KEY
});
// Function to fetch contracts from Circle API
async function fetchContracts() {
    let contractData = [];
    try {
        const allContracts = [];
        let page = 1;
        const limit = 100;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const contractsResp = await circleApiService_1.default.get(`/v1/w3s/contracts?page=${page}&limit=${limit}`);
            // logger.info(`Contracts from API page ${page}:`, contractsResp.data);
            const contracts = contractsResp.data?.data?.contracts ||
                contractsResp.data?.contracts ||
                contractsResp.data ||
                [];
            logger_1.logger.info(`Contracts array length page ${page}:`, contracts.length);
            if (contracts.length === 0)
                break;
            allContracts.push(...contracts);
            page++;
            if (contracts.length < limit)
                break; // Assuming if less than limit, it's the last page
        }
        const contracts = allContracts;
        logger_1.logger.info('Total contracts fetched:', contracts.length);
        contractData = contracts
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((c) => {
            const addr = c.address || c.contractAddress;
            return addr && web3_1.default.utils.isAddress(addr);
        })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((c) => ({
            id: c.id,
            address: web3_1.default.utils.toChecksumAddress(c.address || c.contractAddress)
        }));
    }
    catch (apiErr) {
        logger_1.logger.warn('Failed to fetch contracts from Circle API', apiErr.message);
        contractData = [];
    }
    return contractData;
}
// Start USDC watcher if enabled
if (config_1.default.START_USDC_WATCHER && config_1.default.INFURA_RPC_URL) {
    (async () => {
        try {
            // Fetch deployed contracts from Circle API
            const contractData = await fetchContracts();
            const contractAddresses = contractData.map((d) => d.address);
            if (contractAddresses.length > 0) {
                logger_1.logger.info(`Starting USDC Watcher with ${contractAddresses.length} contracts:`, contractAddresses);
                const watcher = new usdcWatcher_1.default({
                    rpcUrl: config_1.default.INFURA_RPC_URL,
                    wsUrl: config_1.default.INFURA_WS_URL,
                    usdcAddress: config_1.default.USDC_ADDRESS,
                    contractData: contractData,
                    processHistoricalTransfers: config_1.default.PROCESS_HISTORICAL_TRANSFERS
                }, circleService);
                logger_1.logger.info('USDCWatcher instance created, calling start()');
                await watcher.start();
                logger_1.logger.info(`USDC Watcher started successfully, watching ${contractAddresses.length} contracts`);
                // Update contracts every 2 minutes
                setInterval(async () => {
                    try {
                        const newContractData = await fetchContracts();
                        watcher.updateContractData(newContractData);
                        logger_1.logger.info(`Updated USDC Watcher with ${newContractData.length} contracts`);
                    }
                    catch (updateErr) {
                        logger_1.logger.error('Failed to update contracts', updateErr.message);
                    }
                }, 2 * 60 * 1000); // 2 minutes
            }
            else {
                logger_1.logger.info('USDC Watcher enabled but no deployed contracts with addresses found in Circle API');
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to start USDC Watcher', err.message);
        }
    })();
}
else if (config_1.default.START_USDC_WATCHER && !config_1.default.INFURA_RPC_URL) {
    logger_1.logger.info('INFURA_RPC_URL not configured, skipping USDC Watcher start');
}
const port = config_1.default.PORT ?? 8080;
const server = app_1.app.listen(port, () => {
    logger_1.logger.info(`Server is running at http://demo.monerepay.com:${port}`);
});
process.on('SIGINT', function () {
    (0, sqliteDB_1.cleanupDB)();
    server.close();
    logger_1.logger.info('Server closed successfully');
});
