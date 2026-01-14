"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = start;
exports.stop = stop;
const web3_1 = __importDefault(require("web3"));
const logger_1 = require("../../services/logging/logger");
const config_1 = __importDefault(require("../../config"));
const contractDAO_1 = require("../db/dao/contractDAO");
const USDC_ADDRESS = config_1.default.USDC_ADDRESS;
const INFURA = config_1.default.INFURA_API_KEY;
const PROCESS_HISTORICAL = config_1.default.PROCESS_HISTORICAL_TRANSFERS;
let web3 = null;
let lastBlock = BigInt(0);
function initProvider() {
    const url = INFURA
        ? `https://sepolia.infura.io/v3/${INFURA}`
        : process.env.WEB3_PROVIDER_URL;
    logger_1.logger.info(`USDCWatcher using RPC URL: ${url}`);
    web3 = new web3_1.default(url);
}
async function pollTransfers() {
    if (!web3)
        return;
    try {
        const latest = await web3.eth.getBlockNumber();
        let fromBlock;
        if (lastBlock === BigInt(0)) {
            fromBlock = PROCESS_HISTORICAL ? (latest > BigInt(1000) ? latest - BigInt(1000) : BigInt(0)) : latest;
        }
        else {
            fromBlock = lastBlock + BigInt(1);
        }
        if (fromBlock > latest)
            return;
        const transferTopic = web3.utils.sha3('Transfer(address,address,uint256)');
        const logs = await web3.eth.getPastLogs({
            address: USDC_ADDRESS,
            fromBlock: fromBlock.toString(),
            toBlock: latest.toString(),
            topics: [transferTopic]
        });
        if (logs && logs.length > 0) {
            logger_1.logger.info(`Detected ${logs.length} USDC logs between ${fromBlock.toString()}-${latest.toString()}`);
            const contracts = await contractDAO_1.contractDAO.getContractsByUser('%');
            for (const l of logs) {
                const to = '0x' + l.topics[2].slice(26);
                for (const c of contracts) {
                    if (!c.contractAddress)
                        continue;
                    if (c.contractAddress.toLowerCase() === to.toLowerCase()) {
                        logger_1.logger.info(`Transfer to tracked contract ${c.contractId} (${c.contractAddress})`);
                        // TODO: implement split execution
                    }
                }
            }
        }
        lastBlock = latest;
    }
    catch (err) {
        logger_1.logger.error('Error in pollTransfers', err);
    }
}
let intervalId = null;
function start() {
    if (!config_1.default.START_USDC_WATCHER) {
        logger_1.logger.info('USDCWatcher disabled by config');
        return;
    }
    initProvider();
    intervalId = setInterval(pollTransfers, 15 * 1000);
    logger_1.logger.info('USDCWatcher started');
}
function stop() {
    if (intervalId)
        clearInterval(intervalId);
}
exports.default = { start, stop };
