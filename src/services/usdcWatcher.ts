import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
import CircleService from './circleService';

interface USDCWatcherConfig {
  rpcUrl: string;
  wsUrl?: string;
  contractAddresses: string[];
  usdcAddress: string;
  circleApiKey: string;
  circleWalletId: string;
  processHistoricalTransfers?: boolean;
  [key: string]: any;
}

interface USDCABI {
  constant: boolean;
  inputs: { name: string; type: string }[];
  name: string;
  outputs: { name: string; type: string }[];
  type: string;
  anonymous?: boolean;
}

interface TransferEvent {
  returnValues: {
    from: string;
    to: string;
    value: string;
  };
  transactionHash: string;
  blockNumber: number;
  [key: string]: any;
}

interface Web3Subscription {
  unsubscribe: () => void;
  on: (event: string, callback: Function) => void;
  [key: string]: any;
}

class USDCWatcher {
  private config: USDCWatcherConfig;
  private circleService: CircleService;
  private web3: Web3;
  private usdcABI: USDCABI[];
  private usdcContract: any;
  private isRunning: boolean;
  private subscriptions: Web3Subscription[];
  private interval: NodeJS.Timeout | null;
  private catchupInterval: NodeJS.Timeout | null;
  public lastBlock: number;
  public eventsDetected: number;
  public splitsExecuted: number;
  private lastChecked: string | null;

  constructor(config: USDCWatcherConfig, circleService: CircleService) {
    this.config = config;
    this.circleService = circleService;
    // Use WebSocket for real-time monitoring
    this.web3 = new Web3(
      new Web3.providers.WebsocketProvider(
        config.wsUrl || config.rpcUrl.replace('https://', 'wss://')
      )
    );

    // USDC Contract ABI (Transfer event and balanceOf)
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

    this.usdcContract = new this.web3.eth.Contract(
      this.usdcABI,
      config.usdcAddress
    );

    // State
    this.isRunning = false;
    this.subscriptions = [];
    this.interval = null;
    this.catchupInterval = null;
    this.lastBlock = 0;
    this.eventsDetected = 0;
    this.splitsExecuted = 0;
    this.lastChecked = null;

    // Silent initialization
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Watcher already running');
      return;
    }

    try {
      // Try WebSocket first, fall back to polling if it fails
      let useWebSocket = true;

      // Test WebSocket connection
      try {
        const currentBlock = await this.web3.eth.getBlockNumber();
        this.lastBlock = currentBlock;
        console.log(
          `✅ Web3 connection successful, current block: ${currentBlock}`
        );
      } catch (web3Error: any) {
        console.log(
          `⚠️ Web3 connection failed: ${web3Error.message} - falling back to polling mode`
        );
        useWebSocket = false;
        // Create HTTP provider as fallback
        this.web3 = new Web3(
          new Web3HttpProvider(this.config.rpcUrl.replace('wss://', 'https://'))
        );
        const currentBlock = await this.web3.eth.getBlockNumber();
        this.lastBlock = currentBlock;
      }

      // Process recent transfers first (last 24 hours) to catch immediate transfers
      console.log(`🔄 Processing recent transfers first (last 24 hours)...`);
      const currentBlock = await this.web3.eth.getBlockNumber();
      const blocksPerDay = Math.floor((24 * 60 * 60) / 12); // ~7200 blocks per day

      // First check recent 24 hours
      this.lastBlock = Math.max(0, currentBlock - blocksPerDay);
      console.log(
        `📊 Processing recent transfers from block: ${this.lastBlock} (last 24 hours)`
      );
      await this.checkForTransfers();

      // Then check older historical transfers (7 days total)
      if (this.config.processHistoricalTransfers) {
        console.log(`📊 Processing older historical transfers...`);
        this.lastBlock = Math.max(0, currentBlock - blocksPerDay * 7); // 7 days back
        console.log(
          `📊 Processing from block: ${this.lastBlock} (full 7 days)`
        );
        await this.checkForTransfers();
      }

      this.isRunning = true;

      if (useWebSocket) {
        // Set up WebSocket monitoring
        console.log('🔌 Attempting WebSocket monitoring...');
        await this.setupWebSocketMonitoring();

        // Also set up periodic catch-up checks every 2 seconds
        console.log('⏰ Setting up periodic catch-up checks (2 sec intervals)');
        this.catchupInterval = setInterval(() => {
          this.checkRecentTransfers().catch((error) => {
            console.log(`❌ Catch-up check error: ${error.message}`);
          });
        }, 2000); // 2 seconds
      } else {
        // Fall back to polling
        console.log('⏰ Falling back to polling mode (2s intervals)');
        this.interval = setInterval(() => {
          this.checkForTransfers().catch((error: any) => {
            console.log(`❌ Polling error: ${error.message}`);
          });
        }, 2000); // 2 seconds
      }
    } catch (error: any) {
      console.error('❌ Failed to start watcher:', error);
      throw error;
    }
  }

  async checkForTransfers(): Promise<void> {
    try {
      // Check if we have contracts to monitor
      if (
        !this.config.contractAddresses ||
        this.config.contractAddresses.length === 0
      ) {
        return; // Silently skip if no contracts to monitor
      }

      const currentBlock = await this.web3.eth.getBlockNumber();

      // Only check if new blocks exist
      if (currentBlock <= this.lastBlock) {
        return;
      }

      // Validate RPC connection
      if (!this.web3.currentProvider) {
        throw new Error(
          'Web3 provider not connected - check INFURA_API_KEY or use alternative RPC'
        );
      }

      // Process blocks in chunks to avoid query limits (silent operation)
      const chunkSize = 100; // Process 100 blocks at a time to avoid Infura limits
      let fromBlock = this.lastBlock + 1;
      let allEvents: TransferEvent[] = [];

      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);

        // Get Transfer events to YOUR specific contract addresses for this chunk
        // More efficient than scanning all USDC transfers
        const transferPromises = this.config.contractAddresses.map(
          async (contractAddr) => {
            try {
              return await this.usdcContract.getPastEvents('Transfer', {
                filter: { to: contractAddr },
                fromBlock: fromBlock,
                toBlock: toBlock
              });
            } catch (error: any) {
              // Log specific errors for debugging but continue
              if (error.message.includes('Too Many Requests')) {
                console.log('⚠️ Rate limit hit - reducing polling frequency');
              } else if (error.message.includes('Invalid JSON RPC response')) {
                console.log(
                  '⚠️ RPC connection issue - check Infura configuration'
                );
              }
              return [];
            }
          }
        );

        const eventArrays = await Promise.all(transferPromises);
        const events = eventArrays.flat();

        allEvents.push(...events);
        fromBlock = toBlock + 1;
      }

      // Only log if transfers are actually found
      if (allEvents.length > 0) {
        console.log(
          `📨 Found ${allEvents.length} USDC transfer(s) to monitored contracts`
        );

        // Process each event immediately
        for (const event of allEvents) {
          await this.processTransfer(event);
        }
      }

      // Update last block (silent)
      this.lastBlock = currentBlock;
      this.lastChecked = new Date().toISOString();
    } catch (error: any) {
      let errorMessage = 'Unknown error in transfer monitoring';

      if (error.message.includes('Invalid JSON RPC response')) {
        errorMessage =
          'RPC connection failed - check INFURA_API_KEY or try alternative RPC provider';
      } else if (error.message.includes('Too Many Requests')) {
        errorMessage =
          'Rate limit exceeded - get your own Infura API key or use paid plan';
      } else if (error.message.includes('connection')) {
        errorMessage = 'Network connection issue - check internet connectivity';
      } else if (error.message.includes('timeout')) {
        errorMessage =
          'Request timeout - blockchain may be congested or RPC is slow';
      } else if (error.message.includes("Couldn't connect to node")) {
        errorMessage =
          'Cannot connect to RPC node - verify INFURA_API_KEY is correct and has quota';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.log(`❌ Transfer monitoring error: ${errorMessage}`);
    }
  }

  async processTransfer(event: TransferEvent): Promise<void> {
    const { from, to, value } = event.returnValues;
    const amount = parseInt(value);
    const timestamp = new Date().toISOString();
    const transferId = `${event.transactionHash.slice(0, 10)}...${event.transactionHash.slice(-6)}`;

    this.eventsDetected++;

    console.log(`🔔 USDC Transfer: ${amount / 1000000} USDC to ${to}`);

    // Execute splitUSDC immediately - no restrictions
    try {
      console.log(`🚀 Executing split automatically...`);
      const result = await this.circleService.executeSplit(amount, to);
      console.log(`✅ Split successful`);
      this.splitsExecuted++;
    } catch (error: any) {
      console.log(`❌ Split failed: ${error.message}`);
      // Don't return - the split will be retried on next transfer detection
    }
  }

  // Check recent transfers (last 100 blocks) for catch-up
  async checkRecentTransfers(): Promise<void> {
    try {
      if (
        !this.config.contractAddresses ||
        this.config.contractAddresses.length === 0
      ) {
        return; // Silently skip if no contracts to monitor
      }

      const currentBlock = await this.web3.eth.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100); // Check last 100 blocks

      console.log(
        `🔄 Catch-up: Checking blocks ${fromBlock} to ${currentBlock}`
      );

      // Process blocks in smaller chunks for catch-up
      const chunkSize = 10; // Smaller chunks for catch-up
      let allEvents: TransferEvent[] = [];

      for (
        let blockStart = fromBlock;
        blockStart <= currentBlock;
        blockStart += chunkSize
      ) {
        const blockEnd = Math.min(blockStart + chunkSize - 1, currentBlock);

        // Get Transfer events for this small chunk
        const transferPromises = this.config.contractAddresses.map(
          async (contractAddr) => {
            try {
              return await this.usdcContract.getPastEvents('Transfer', {
                filter: { to: contractAddr },
                fromBlock: blockStart,
                toBlock: blockEnd
              });
            } catch (error: any) {
              console.log(
                `⚠️ Catch-up query failed for ${contractAddr}: ${error.message}`
              );
              return [];
            }
          }
        );

        const eventArrays = await Promise.all(transferPromises);
        const events = eventArrays.flat();
        allEvents.push(...events);
      }

      // Remove duplicates (events might be detected multiple times)
      const uniqueEvents = allEvents.filter(
        (event, index, self) =>
          index ===
          self.findIndex((e) => e.transactionHash === event.transactionHash)
      );

      if (uniqueEvents.length > 0) {
        console.log(
          `📨 Catch-up found ${uniqueEvents.length} transfer(s) to monitored contracts`
        );

        // Process each event
        for (const event of uniqueEvents) {
          await this.processTransfer(event);
        }
      }
    } catch (error: any) {
      console.log(`❌ Catch-up check failed: ${error.message}`);
    }
  }

  // Manual transfer check
  async checkNow(): Promise<void> {
    console.log('🔍 Manual transfer check initiated');
    await this.checkForTransfers();
  }

  async restartSubscription(): Promise<void> {
    try {
      // Unsubscribe from existing subscriptions
      if (this.subscriptions && this.subscriptions.length > 0) {
        this.subscriptions.forEach((sub) => {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
          }
        });
        this.subscriptions = [];
      }

      const contractAddresses = this.config.contractAddresses || [];
      if (contractAddresses.length === 0) return;

      // Recreate individual subscriptions
      for (const contractAddr of contractAddresses) {
        const subscription = this.usdcContract.events.Transfer({
          filter: { to: contractAddr },
          fromBlock: 'latest'
        });

        subscription.on('data', (event: TransferEvent) => {
          const { from, to, value } = event.returnValues;
          const amount = parseInt(value);
          console.log(
            `🔔 WebSocket: USDC Transfer to ${to} - ${amount / 1000000} USDC`
          );
          this.processTransfer(event).catch((error: any) => {
            console.log(
              `❌ WebSocket event processing failed: ${error.message}`
            );
          });
        });

        subscription.on('error', (error: Error) => {
          console.log(
            `❌ WebSocket subscription error for ${contractAddr}: ${error.message}`
          );
        });

        this.subscriptions.push(subscription);
      }

      console.log(
        `🔄 Restarted ${this.subscriptions.length} WebSocket subscriptions`
      );
    } catch (error: any) {
      console.log(
        `❌ Failed to restart WebSocket subscription: ${error.message}`
      );
    }
  }

  async setupWebSocketMonitoring(): Promise<void> {
    try {
      // Subscribe to Transfer events for all monitored contract addresses
      const contractAddresses = this.config.contractAddresses || [];
      if (contractAddresses.length === 0) {
        console.log(
          '⚠️ No contract addresses to monitor - WebSocket subscription skipped'
        );
        return;
      }

      console.log(
        `🔌 Setting up WebSocket subscription for ${contractAddresses.length} contracts...`
      );
      console.log(`📋 Contract addresses: ${contractAddresses.join(', ')}`);

      // Create individual subscriptions for each contract address (more reliable than array filter)
      this.subscriptions = [];

      for (const contractAddr of contractAddresses) {
        console.log(`🔌 Creating subscription for: ${contractAddr}`);

        const subscription = this.usdcContract.events.Transfer({
          filter: { to: contractAddr },
          fromBlock: 'latest'
        });

        subscription.on('data', (event: TransferEvent) => {
          const { from, to, value } = event.returnValues;
          const amount = parseInt(value);
          console.log(
            `🔔 WebSocket: USDC Transfer to ${to} - ${amount / 1000000} USDC`
          );
          this.processTransfer(event).catch((error: any) => {
            console.log(
              `❌ WebSocket event processing failed: ${error.message}`
            );
          });
        });

        subscription.on('error', (error: Error) => {
          console.log(
            `❌ WebSocket subscription error for ${contractAddr}: ${error.message}`
          );
          // Don't throw, just log - system will continue
        });

        subscription.on('connected', (subscriptionId: string) => {
          console.log(
            `🔗 WebSocket connected for ${contractAddr} (ID: ${subscriptionId})`
          );
        });

        this.subscriptions.push(subscription);
      }

      console.log(
        `✅ Created ${this.subscriptions.length} individual WebSocket subscriptions`
      );
      console.log('✅ USDC Watcher started with WebSocket monitoring');
    } catch (error: any) {
      console.log(
        `❌ WebSocket setup failed: ${error.message} - falling back to polling`
      );
      // Fall back to polling
      this.interval = setInterval(() => {
        this.checkForTransfers().catch((error: any) => {
          console.log(`❌ Polling error: ${error.message}`);
        });
      }, 2000); // 2 seconds
    }
  }

  stop(): void {
    // Unsubscribe from all subscriptions
    if (this.subscriptions && this.subscriptions.length > 0) {
      this.subscriptions.forEach((sub) => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      this.subscriptions = [];
    }

    // Clear polling intervals if they exist
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.catchupInterval) {
      clearInterval(this.catchupInterval);
      this.catchupInterval = null;
    }

    // Close WebSocket connection
    if (
      this.web3 &&
      this.web3.currentProvider &&
      (this.web3.currentProvider as any).disconnect
    ) {
      (this.web3.currentProvider as any).disconnect();
    }

    this.isRunning = false;
    console.log('⏹️ USDC Watcher stopped');
  }
}

export default USDCWatcher;
