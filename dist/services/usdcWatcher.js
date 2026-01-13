"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const web3_1 = __importDefault(require("web3"));
const web3_providers_http_1 = __importDefault(require("web3-providers-http"));
class USDCWatcher {
    constructor(config, circleService) {
        this.usdcContract = null;
        this.isRunning = false;
        this.subscriptions = [];
        this.interval = null;
        this.catchupInterval = null;
        this.lastBlock = BigInt(0);
        this.eventsDetected = 0;
        this.splitsExecuted = 0;
        this.lastChecked = null;
        this.usdcABI = [
            {
                constant: true,
                inputs: [{ name: '_owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: 'balance', type: 'uint256' }],
                type: 'function'
            },
            {
                anonymous: false,
                inputs: [
                    { indexed: true, name: 'from', type: 'address' },
                    { indexed: true, name: 'to', type: 'address' },
                    { indexed: false, name: 'value', type: 'uint256' }
                ],
                name: 'Transfer',
                type: 'event'
            }
        ];
        this.config = config;
        this.circleService = circleService;
        // Web3 will be initialized in start() with HTTP provider
    }
    async start() {
        if (this.isRunning)
            return;
        console.log('USDCWatcher starting...');
        try {
            console.log('Initializing Web3 with providers');
            console.log('Using HTTP provider');
            this.web3 = new web3_1.default(new web3_providers_http_1.default(this.config.rpcUrl));
            this.usdcContract = new this.web3.eth.Contract(this.usdcABI, this.config.usdcAddress);
            let currentBlock = await this.web3.eth.getBlockNumber();
            this.lastBlock = currentBlock;
            console.log('Got initial current block:', currentBlock.toString());
            currentBlock = await this.web3.eth.getBlockNumber();
            const blocksPerDay = Math.floor((24 * 60 * 60) / 12);
            this.lastBlock =
                currentBlock > BigInt(3600) ? currentBlock - BigInt(3600) : BigInt(0);
            console.log('Set lastBlock for initial scan to:', this.lastBlock.toString());
            await this.checkForTransfers();
            if (this.config.processHistoricalTransfers) {
                try {
                    this.lastBlock =
                        currentBlock > BigInt(172800)
                            ? currentBlock - BigInt(172800)
                            : BigInt(0);
                    console.log('Processing historical transfers from block:', this.lastBlock.toString());
                    await this.checkForTransfers();
                    console.log('Historical processing completed');
                }
                catch (histErr) {
                    console.error('Historical processing failed:', histErr);
                    // Continue without historical
                    this.lastBlock = currentBlock - BigInt(7200); // 1 day back
                }
            }
            this.isRunning = true;
            this.interval = setInterval(() => {
                this.checkForTransfers().catch((err) => console.log('USDCWatcher poll error', err.message));
            }, 10000);
        }
        catch (err) {
            console.error('Failed to start USDCWatcher', err);
            throw err;
        }
    }
    async checkForTransfers() {
        try {
            if (!this.config.contractData || this.config.contractData.length === 0)
                return;
            const currentBlock = await this.web3.eth.getBlockNumber();
            console.log(`USDCWatcher polling: current block ${currentBlock}, last checked ${this.lastBlock}`);
            if (currentBlock <= this.lastBlock)
                return;
            if (!this.web3.currentProvider)
                throw new Error('Web3 provider not connected');
            console.log(`USDCWatcher checking blocks ${this.lastBlock + BigInt(1)} to ${currentBlock} for ${this.config.contractData.length} contracts`);
            const chunkSize = 100;
            let fromBlock = this.lastBlock + BigInt(1);
            const allEvents = [];
            while (fromBlock <= currentBlock) {
                const toBlock = fromBlock + BigInt(chunkSize) - BigInt(1);
                const actualToBlock = toBlock > currentBlock ? currentBlock : toBlock;
                const transferPromises = this.config.contractData.map(async (contractData) => {
                    try {
                        // Get all Transfer events from USDC contract in the block range
                        const events = await this.usdcContract.getPastEvents('Transfer', {
                            fromBlock: fromBlock.toString(),
                            toBlock: actualToBlock.toString()
                        });
                        // Filter events where to address matches the contract
                        return events.filter((event) => event.returnValues.to.toLowerCase() ===
                            contractData.address.toLowerCase());
                    }
                    catch (error) {
                        console.log('USDCWatcher event fetch error', error.message);
                        return [];
                    }
                });
                const eventArrays = await Promise.all(transferPromises);
                allEvents.push(...eventArrays.flat());
                fromBlock = actualToBlock + BigInt(1);
            }
            if (allEvents.length > 0) {
                console.log(`USDCWatcher found ${allEvents.length} transfer events in block range`);
                for (const event of allEvents) {
                    await this.processTransfer(event);
                }
            }
            this.lastBlock = currentBlock;
            this.lastChecked = new Date().toISOString();
        }
        catch (error) {
            console.log('USDCWatcher error in checkForTransfers:', error.message || error);
        }
    }
    async processTransfer(event) {
        const { from, to, value } = event.returnValues;
        const amount = parseInt(value, 10);
        this.eventsDetected++;
        try {
            await this.circleService.executeReceive(amount, to);
            console.log(`USDCWatcher executed receive for ${amount} USDC on contract ${to}`);
            const result = await this.circleService.executeSplit(amount, to);
            this.splitsExecuted++;
            console.log(`USDCWatcher executed split for ${amount} USDC on contract ${to}`);
        }
        catch (err) {
            console.log('USDCWatcher execution failed:', err.message || err);
        }
    }
    async setupWebSocketMonitoring() {
        const contractData = this.config.contractData || [];
        if (contractData.length === 0)
            return;
        this.subscriptions = [];
        for (const contract of contractData) {
            const subscription = this.usdcContract.events.Transfer({
                filter: { to: contract.address },
                fromBlock: 'latest'
            });
            subscription.on('data', (event) => {
                this.processTransfer(event).catch((err) => console.log('WS event process failed', err.message));
            });
            subscription.on('error', (err) => console.log('WS subscription error', err.message));
            this.subscriptions.push(subscription);
        }
    }
    updateContractData(newContractData) {
        this.config.contractData = newContractData;
    }
    stop() {
        if (this.subscriptions && this.subscriptions.length > 0) {
            this.subscriptions.forEach((sub) => {
                if (sub && typeof sub.unsubscribe === 'function')
                    sub.unsubscribe();
            });
            this.subscriptions = [];
        }
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.catchupInterval) {
            clearInterval(this.catchupInterval);
            this.catchupInterval = null;
        }
        if (this.web3 && this.web3.currentProvider?.disconnect) {
            this.web3.currentProvider.disconnect();
        }
        this.isRunning = false;
    }
}
exports.default = USDCWatcher;
