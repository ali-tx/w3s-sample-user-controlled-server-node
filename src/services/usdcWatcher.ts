/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
import Web3WsProvider from 'web3-providers-ws';
import type { Contract } from 'web3-eth-contract';

type ContractData = {
  id: string;
  address: string;
};

type WatcherConfig = {
  rpcUrl: string;
  wsUrl?: string | null;
  contractData?: ContractData[];
  usdcAddress?: string | null;
  processHistoricalTransfers?: boolean;
};

export default class USDCWatcher {
  config: WatcherConfig;
  circleService: any;
  web3!: Web3;
  wsWeb3: Web3 | null = null;
  usdcContract: Contract<any> | null = null;
  isRunning = false;
  subscriptions: any[] = [];
  interval: any = null;
  catchupInterval: any = null;
  lastBlock: bigint = BigInt(0);
  eventsDetected = 0;
  splitsExecuted = 0;
  lastChecked: string | null = null;
  processedTxs = new Set<string>();

  private usdcABI = [
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

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error;
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`USDCWatcher: RPC request failed (likely rate limit or network issue), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Should not reach here');
  }

  constructor(config: WatcherConfig, circleService: any) {
    this.config = config;
    this.circleService = circleService;
    // Web3 will be initialized in start() with HTTP or WS provider
  }

  async start() {
    if (this.isRunning) return;
    console.log('USDCWatcher starting...');
    try {
      console.log('Initializing Web3 with providers');
      console.log('Using HTTP provider for polling');
      this.web3 = new Web3(new Web3HttpProvider(this.config.rpcUrl) as any);
      this.usdcContract = new (this.web3.eth.Contract as any)(
        this.usdcABI,
        this.config.usdcAddress
      );
      if (this.config.wsUrl) {
        console.log('Using WebSocket provider for subscriptions');
        this.wsWeb3 = new Web3(new Web3WsProvider(this.config.wsUrl) as any);
      }
      let currentBlock = await this.retryWithBackoff(() => this.web3.eth.getBlockNumber());
      this.lastBlock = currentBlock;
      console.log('Got initial current block:', currentBlock.toString());

      currentBlock = await this.retryWithBackoff(() => this.web3.eth.getBlockNumber());
      const blocksPerDay = Math.floor((24 * 60 * 60) / 12);
      this.lastBlock =
        currentBlock > BigInt(100) ? currentBlock - BigInt(100) : BigInt(0);
      console.log(
        'Set lastBlock for initial scan to:',
        this.lastBlock.toString()
      );
      await this.checkForTransfers();

      if (this.config.processHistoricalTransfers) {
        try {
          this.lastBlock =
            currentBlock > BigInt(86400)
              ? currentBlock - BigInt(86400)
              : BigInt(0);
          console.log(
            'Processing historical transfers from block:',
            this.lastBlock.toString()
          );
          await this.checkForTransfers();
          console.log('Historical processing completed');
        } catch (histErr: any) {
          console.error('Historical processing failed:', histErr);
          // Continue without historical
          this.lastBlock = currentBlock - BigInt(7200); // 1 day back
        }
      }

      // Set up WebSocket monitoring if WS URL is provided
      if (this.config.wsUrl) {
        await this.setupWebSocketMonitoring();
        console.log('WebSocket monitoring set up for real-time transfers');
      }

      this.isRunning = true;
      const pollInterval = this.config.wsUrl ? 60000 : 10000; // 60s if WS, 10s if HTTP
      this.interval = setInterval(() => {
        this.checkForTransfers().catch((err) =>
          console.log('USDCWatcher poll error', err.message)
        );
      }, pollInterval);
    } catch (err: any) {
      console.error('Failed to start USDCWatcher', err);
      throw err;
    }
  }

  async checkForTransfers() {
    try {
      if (!this.config.contractData || this.config.contractData.length === 0)
        return;
      const currentBlock = await this.retryWithBackoff(() => this.web3.eth.getBlockNumber());
      console.log(
        `USDCWatcher polling: current block ${currentBlock}, last checked ${this.lastBlock}`
      );
      if (currentBlock <= this.lastBlock) return;
      if (!this.web3.currentProvider)
        throw new Error('Web3 provider not connected');

      console.log(
        `USDCWatcher checking blocks ${this.lastBlock + BigInt(1)} to ${currentBlock} for ${
          this.config.contractData.length
        } contracts`
      );

      const chunkSize = 200;
      let fromBlock: bigint = this.lastBlock + BigInt(1);
      const allEvents: any[] = [];

      while (fromBlock <= currentBlock) {
        const toBlock: bigint = fromBlock + BigInt(chunkSize) - BigInt(1);
        const actualToBlock = toBlock > currentBlock ? currentBlock : toBlock;
        try {
          // Get all Transfer events from USDC contract in the block range
          const events: any[] = await this.retryWithBackoff(() =>
            (this.usdcContract as any).getPastEvents('Transfer', {
              fromBlock: fromBlock.toString(),
              toBlock: actualToBlock.toString()
            })
          );
          // Filter events where to address matches any contract
          const relevantEvents = events.filter((event: any) =>
            this.config.contractData!.some(
              (contractData) =>
                event.returnValues.to.toLowerCase() ===
                contractData.address.toLowerCase()
            )
          );
          allEvents.push(...relevantEvents);
        } catch (error: any) {
          // Continue to next chunk
        }
        fromBlock = actualToBlock + BigInt(1);
      }

      if (allEvents.length > 0) {
        console.log(
          `USDCWatcher found ${allEvents.length} transfer events in block range`
        );
        for (const event of allEvents) {
          await this.processTransfer(event);
        }
      } else {
        console.log('USDCWatcher: No transfer events found in this check');
      }

      this.lastBlock = currentBlock;
      this.lastChecked = new Date().toISOString();
    } catch (error: any) {
      console.log(
        'USDCWatcher: Failed to check for transfers after retries (RPC issues), will retry in next poll cycle'
      );
    }
  }

  async processTransfer(event: any) {
    if (this.processedTxs.has(event.transactionHash)) return;
    this.processedTxs.add(event.transactionHash);
    const { from, to, value } = event.returnValues;
    const amount = parseInt(value, 10);
    this.eventsDetected++;
    try {
      await this.circleService.executeReceive(amount, to);
      console.log(
        `USDCWatcher executed receive for ${amount} USDC on contract ${to}`
      );
      const result = await this.circleService.executeSplit(amount, to);
      this.splitsExecuted++;
      console.log(
        `USDCWatcher executed split for ${amount} USDC on contract ${to}`
      );
    } catch (err: any) {
      console.log('USDCWatcher execution failed:', err.message || err);
    }
  }

  async setupWebSocketMonitoring() {
    if (!this.wsWeb3 || !this.config.contractData || this.config.contractData.length === 0) return;
    this.subscriptions = [];
    const wsContract = new (this.wsWeb3.eth.Contract as any)(
      this.usdcABI,
      this.config.usdcAddress
    );
    for (const contract of this.config.contractData) {
      const subscription = wsContract.events.Transfer({
        filter: { to: contract.address },
        fromBlock: 'latest'
      });
      subscription.on('data', (event: any) => {
        this.processTransfer(event).catch((err: any) =>
          console.log('WS event process failed', err.message)
        );
      });
      subscription.on('error', (err: any) =>
        console.log('WS subscription error', err.message)
      );
      this.subscriptions.push(subscription);
    }
  }

  updateContractData(newContractData: ContractData[]) {
    this.config.contractData = newContractData;
  }

  stop() {
    if (this.subscriptions && this.subscriptions.length > 0) {
      this.subscriptions.forEach((sub) => {
        if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
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
    if (this.web3 && (this.web3.currentProvider as any)?.disconnect) {
      (this.web3.currentProvider as any).disconnect();
    }
    if (this.wsWeb3 && (this.wsWeb3.currentProvider as any)?.disconnect) {
      (this.wsWeb3.currentProvider as any).disconnect();
    }
    this.isRunning = false;
  }
}
