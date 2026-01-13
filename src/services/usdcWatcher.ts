/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
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
  usdcContract: Contract<any> | null = null;
  isRunning = false;
  subscriptions: any[] = [];
  interval: any = null;
  catchupInterval: any = null;
  lastBlock: bigint = BigInt(0);
  eventsDetected = 0;
  splitsExecuted = 0;
  lastChecked: string | null = null;

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

  constructor(config: WatcherConfig, circleService: any) {
    this.config = config;
    this.circleService = circleService;
    // Web3 will be initialized in start() with HTTP provider
  }

  async start() {
    if (this.isRunning) return;
    console.log('USDCWatcher starting...');
    try {
      console.log('Initializing Web3 with providers');
      console.log('Using HTTP provider');
      this.web3 = new Web3(new Web3HttpProvider(this.config.rpcUrl) as any);
      this.usdcContract = new (this.web3.eth.Contract as any)(
        this.usdcABI,
        this.config.usdcAddress
      );
      let currentBlock = await this.web3.eth.getBlockNumber();
      this.lastBlock = currentBlock;
      console.log('Got initial current block:', currentBlock.toString());

      currentBlock = await this.web3.eth.getBlockNumber();
      const blocksPerDay = Math.floor((24 * 60 * 60) / 12);
      this.lastBlock =
        currentBlock > BigInt(3600) ? currentBlock - BigInt(3600) : BigInt(0);
      console.log(
        'Set lastBlock for initial scan to:',
        this.lastBlock.toString()
      );
      await this.checkForTransfers();

      if (this.config.processHistoricalTransfers) {
        try {
          this.lastBlock =
            currentBlock > BigInt(172800)
              ? currentBlock - BigInt(172800)
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

      this.isRunning = true;
      this.interval = setInterval(() => {
        this.checkForTransfers().catch((err) =>
          console.log('USDCWatcher poll error', err.message)
        );
      }, 10000);
    } catch (err: any) {
      console.error('Failed to start USDCWatcher', err);
      throw err;
    }
  }

  async checkForTransfers() {
    try {
      if (!this.config.contractData || this.config.contractData.length === 0)
        return;
      const currentBlock = await this.web3.eth.getBlockNumber();
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

      const chunkSize = 100;
      let fromBlock: bigint = this.lastBlock + BigInt(1);
      const allEvents: any[] = [];

      while (fromBlock <= currentBlock) {
        const toBlock: bigint = fromBlock + BigInt(chunkSize) - BigInt(1);
        const actualToBlock = toBlock > currentBlock ? currentBlock : toBlock;
        const transferPromises = this.config.contractData!.map(
          async (contractData) => {
            try {
              // Get all Transfer events from USDC contract in the block range
              const events = await (this.usdcContract as any).getPastEvents(
                'Transfer',
                {
                  fromBlock: fromBlock.toString(),
                  toBlock: actualToBlock.toString()
                }
              );
              // Filter events where to address matches the contract
              return events.filter(
                (event: any) =>
                  event.returnValues.to.toLowerCase() ===
                  contractData.address.toLowerCase()
              );
            } catch (error: any) {
              return [];
            }
          }
        );

        const eventArrays = await Promise.all(transferPromises);
        allEvents.push(...eventArrays.flat());
        fromBlock = actualToBlock + BigInt(1);
      }

      if (allEvents.length > 0) {
        console.log(
          `USDCWatcher found ${allEvents.length} transfer events in block range`
        );
        for (const event of allEvents) {
          await this.processTransfer(event);
        }
      }

      this.lastBlock = currentBlock;
      this.lastChecked = new Date().toISOString();
    } catch (error: any) {
      console.log(
        'USDCWatcher error in checkForTransfers:',
        error.message || error
      );
    }
  }

  async processTransfer(event: any) {
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
    const contractData = this.config.contractData || [];
    if (contractData.length === 0) return;
    this.subscriptions = [];
    for (const contract of contractData) {
      const subscription = (this.usdcContract as any).events.Transfer({
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
    this.isRunning = false;
  }
}
